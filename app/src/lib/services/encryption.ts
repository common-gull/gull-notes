import type { DecryptedMetadata, DecryptedContent } from '../types';
import type { NotesDatabase } from '../db';

interface EncryptionResult {
	ciphertext: ArrayBuffer;
	iv: Uint8Array;
}

import { writable } from 'svelte/store';

/**
 * Cryptographic constants
 */
export const SALT_SIZE = 32; // 256-bit salt for PBKDF2 (increased from 16 for better security)
const IV_SIZE = 12; // 96-bit IV for AES-GCM
const PBKDF2_ITERATIONS = 600000; // OWASP recommended minimum
const MIN_PASSWORD_LENGTH = 8;

/**
 * Session key manager (in-memory only, never persisted)
 * SECURITY: Keys are stored in memory only and never written to disk.
 * Keys are automatically cleared on browser close/refresh.
 */
class SessionKeyManager {
	private dataKey: CryptoKey | null = null;
	// Writable store to trigger reactivity when key changes
	public keyAvailable = writable(false);

	setKey(key: CryptoKey) {
		this.dataKey = key;
		this.keyAvailable.set(true);
	}

	getKey(): CryptoKey | null {
		return this.dataKey;
	}

	/**
	 * Clear the session key from memory
	 * SECURITY: This provides best-effort key zeroing, though JavaScript
	 * doesn't provide guaranteed memory zeroing primitives
	 */
	clearKey() {
		this.dataKey = null;
		this.keyAvailable.set(false);
	}

	hasKey(): boolean {
		return this.dataKey !== null;
	}
}

export const sessionKeyManager = new SessionKeyManager();

// Auto-clear keys on window unload for additional security
if (typeof window !== 'undefined') {
	window.addEventListener('beforeunload', () => {
		sessionKeyManager.clearKey();
	});
}

/**
 * Validate password meets minimum security requirements
 * @param password Password to validate
 * @throws Error if password is invalid
 */
function validatePassword(password: string): void {
	if (!password || typeof password !== 'string') {
		throw new Error('Password must be a non-empty string');
	}
	if (password.length < MIN_PASSWORD_LENGTH) {
		throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
	}
}

/**
 * Validate ArrayBuffer input
 * @param buffer Buffer to validate
 * @param name Parameter name for error messages
 */
function validateBuffer(buffer: ArrayBuffer | Uint8Array, name: string): void {
	if (!buffer) {
		throw new Error(`${name} is required`);
	}
	if (!(buffer instanceof ArrayBuffer || buffer instanceof Uint8Array)) {
		throw new Error(`${name} must be an ArrayBuffer or Uint8Array`);
	}
	if (buffer.byteLength === 0) {
		throw new Error(`${name} cannot be empty`);
	}
}

/**
 * Validate data before encryption
 * @param data Data to validate
 */
function validateEncryptionData(data: unknown): void {
	if (data === null || data === undefined) {
		throw new Error('Data to encrypt cannot be null or undefined');
	}
}

/**
 * Generate a cryptographically secure random salt
 * @returns 256-bit random salt
 */
export function generateSalt(): Uint8Array {
	return crypto.getRandomValues(new Uint8Array(SALT_SIZE));
}

/**
 * Derive Master Key from password using PBKDF2
 * @param password User password (minimum 8 characters)
 * @param salt Salt for key derivation (must be 32 bytes)
 * @returns Master Key (KEK - Key Encryption Key)
 * @throws Error if password or salt is invalid
 */
export async function deriveMasterKey(
	password: string,
	salt: Uint8Array | ArrayBuffer
): Promise<CryptoKey> {
	validatePassword(password);
	validateBuffer(salt, 'salt');

	const encoder = new TextEncoder();
	const keyMaterial = await crypto.subtle.importKey(
		'raw',
		encoder.encode(password),
		'PBKDF2',
		false,
		['deriveBits', 'deriveKey']
	);

	return crypto.subtle.deriveKey(
		{
			name: 'PBKDF2',
			salt: salt as BufferSource,
			iterations: PBKDF2_ITERATIONS,
			hash: 'SHA-256'
		},
		keyMaterial,
		{ name: 'AES-GCM', length: 256 },
		false, // Non-extractable for security (master key should never be exported)
		['encrypt', 'decrypt']
	);
}

/**
 * Generate a random Data Key (DEK)
 * @returns Random 256-bit AES key
 * SECURITY: Key is marked as extractable to support password change operations
 * where the key needs to be re-encrypted with a new master key. In a more
 * restrictive implementation, we could generate non-extractable keys and
 * re-encrypt all data on password change instead.
 */
export async function generateDataKey(): Promise<CryptoKey> {
	return crypto.subtle.generateKey(
		{
			name: 'AES-GCM',
			length: 256
		},
		true, // Extractable - needed for password change and key wrapping
		['encrypt', 'decrypt']
	);
}

/**
 * Encrypt data using AES-256-GCM
 * @param data Data to encrypt (will be JSON stringified)
 * @param key CryptoKey for encryption
 * @returns Ciphertext and IV
 * @throws Error if data or key is invalid
 */
export async function encryptData(
	data: DecryptedMetadata | DecryptedContent,
	key: CryptoKey
): Promise<EncryptionResult> {
	validateEncryptionData(data);
	if (!key) {
		throw new Error('Encryption key is required');
	}

	const encoded = new TextEncoder().encode(JSON.stringify(data));
	const iv = crypto.getRandomValues(new Uint8Array(IV_SIZE));

	const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, key, encoded);

	return { ciphertext, iv };
}

/**
 * Decrypt data using AES-256-GCM
 * @param ciphertext Encrypted data
 * @param iv Initialization vector
 * @param key CryptoKey for decryption
 * @returns Decrypted data
 * @throws Error with generic message if decryption fails (prevents timing attacks)
 */
export async function decryptData<T = DecryptedMetadata | DecryptedContent>(
	ciphertext: ArrayBuffer,
	iv: Uint8Array | ArrayBuffer,
	key: CryptoKey
): Promise<T> {
	validateBuffer(ciphertext, 'ciphertext');
	validateBuffer(iv, 'iv');
	if (!key) {
		throw new Error('Decryption key is required');
	}

	try {
		const decrypted = await crypto.subtle.decrypt(
			{ name: 'AES-GCM', iv: iv as BufferSource },
			key,
			ciphertext
		);

		const decoded = new TextDecoder().decode(decrypted);
		return JSON.parse(decoded) as T;
	} catch {
		// Normalize all decryption errors to prevent timing/oracle attacks
		// Don't leak whether it was authentication failure, wrong key, or corrupted data
		throw new Error('Decryption failed');
	}
}

/**
 * Encrypt the Data Key with the Master Key
 * @param dataKey Data Key to encrypt
 * @param masterKey Master Key (KEK)
 * @returns Encrypted data key and IV
 * @throws Error if keys are invalid
 */
export async function encryptDataKey(
	dataKey: CryptoKey,
	masterKey: CryptoKey
): Promise<EncryptionResult> {
	if (!dataKey || !masterKey) {
		throw new Error('Both dataKey and masterKey are required');
	}

	const exported = await crypto.subtle.exportKey('raw', dataKey);
	const iv = crypto.getRandomValues(new Uint8Array(IV_SIZE));

	const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, masterKey, exported);

	return { ciphertext, iv };
}

/**
 * Decrypt the Data Key with the Master Key
 * @param encryptedKey Encrypted data key
 * @param iv Initialization vector
 * @param masterKey Master Key (KEK)
 * @returns Decrypted Data Key
 * @throws Error with generic message if decryption fails
 */
export async function decryptDataKey(
	encryptedKey: ArrayBuffer,
	iv: Uint8Array | ArrayBuffer,
	masterKey: CryptoKey
): Promise<CryptoKey> {
	validateBuffer(encryptedKey, 'encryptedKey');
	validateBuffer(iv, 'iv');
	if (!masterKey) {
		throw new Error('Master key is required');
	}

	try {
		const decrypted = await crypto.subtle.decrypt(
			{ name: 'AES-GCM', iv: iv as BufferSource },
			masterKey,
			encryptedKey
		);

		return crypto.subtle.importKey('raw', decrypted, { name: 'AES-GCM', length: 256 }, true, [
			'encrypt',
			'decrypt'
		]);
	} catch {
		// Normalize error to prevent timing attacks
		throw new Error('Failed to decrypt data key');
	}
}

/**
 * Store encrypted data key in vault settings
 * @param db Database instance for the vault
 * @param encryptedKey Encrypted data key
 * @param iv IV used for encrypting the data key
 * @param salt Salt used for password derivation
 */
export async function storeEncryptedDataKey(
	db: NotesDatabase,
	encryptedKey: ArrayBuffer,
	iv: Uint8Array,
	salt: Uint8Array
): Promise<void> {
	await db.settings.put({
		id: 'encrypted_data_key',
		data: {
			encryptedKey,
			keyIv: iv,
			salt
		}
	});
}

/**
 * Retrieve encrypted data key from vault settings
 * @param db Database instance for the vault
 * @returns Encrypted key data or null if not found
 */
export async function retrieveEncryptedDataKey(
	db: NotesDatabase
): Promise<{ encryptedKey: ArrayBuffer; keyIv: Uint8Array; salt: Uint8Array } | null> {
	const record = await db.settings.get('encrypted_data_key');
	if (!record) return null;
	return record.data as { encryptedKey: ArrayBuffer; keyIv: Uint8Array; salt: Uint8Array };
}

/**
 * Encrypt generic settings data using AES-256-GCM
 * @param settings Settings object to encrypt (will be JSON stringified)
 * @param key CryptoKey for encryption
 * @returns Ciphertext and IV
 * @throws Error if settings or key is invalid
 */
export async function encryptSettings<T>(settings: T, key: CryptoKey): Promise<EncryptionResult> {
	validateEncryptionData(settings);
	if (!key) {
		throw new Error('Encryption key is required');
	}

	const encoded = new TextEncoder().encode(JSON.stringify(settings));
	const iv = crypto.getRandomValues(new Uint8Array(IV_SIZE));

	const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, key, encoded);

	return { ciphertext, iv };
}

/**
 * Decrypt generic settings data using AES-256-GCM
 * @param ciphertext Encrypted settings data
 * @param iv Initialization vector
 * @param key CryptoKey for decryption
 * @returns Decrypted settings object
 * @throws Error with generic message if decryption fails
 */
export async function decryptSettings<T>(
	ciphertext: ArrayBuffer,
	iv: Uint8Array | ArrayBuffer,
	key: CryptoKey
): Promise<T> {
	validateBuffer(ciphertext, 'ciphertext');
	validateBuffer(iv, 'iv');
	if (!key) {
		throw new Error('Decryption key is required');
	}

	try {
		const decrypted = await crypto.subtle.decrypt(
			{ name: 'AES-GCM', iv: iv as BufferSource },
			key,
			ciphertext
		);

		const decoded = new TextDecoder().decode(decrypted);
		return JSON.parse(decoded) as T;
	} catch {
		// Normalize error to prevent timing attacks
		throw new Error('Decryption failed');
	}
}
