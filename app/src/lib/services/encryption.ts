import type { DecryptedMetadata, DecryptedContent } from '../types';

interface EncryptionResult {
	ciphertext: ArrayBuffer;
	iv: Uint8Array;
}

import { writable } from 'svelte/store';

/**
 * Session key manager (in-memory only, never persisted)
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

	clearKey() {
		this.dataKey = null;
		this.keyAvailable.set(false);
	}

	hasKey(): boolean {
		return this.dataKey !== null;
	}
}

export const sessionKeyManager = new SessionKeyManager();

/**
 * Derive Master Key from password using PBKDF2
 * @param password User password
 * @param salt Salt for key derivation (should be stored with encrypted data key)
 * @returns Master Key (KEK - Key Encryption Key)
 */
export async function deriveMasterKey(
	password: string,
	salt: Uint8Array | ArrayBuffer
): Promise<CryptoKey> {
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
			iterations: 600000, // OWASP recommended
			hash: 'SHA-256'
		},
		keyMaterial,
		{ name: 'AES-GCM', length: 256 },
		true,
		['encrypt', 'decrypt']
	);
}

/**
 * Generate a random Data Key (DEK)
 * @returns Random 256-bit AES key
 */
export async function generateDataKey(): Promise<CryptoKey> {
	return crypto.subtle.generateKey(
		{
			name: 'AES-GCM',
			length: 256
		},
		true, // extractable
		['encrypt', 'decrypt']
	);
}

/**
 * Encrypt data using AES-256-GCM
 * @param data Data to encrypt (will be JSON stringified)
 * @param key CryptoKey for encryption
 * @returns Ciphertext and IV
 */
export async function encryptData(
	data: DecryptedMetadata | DecryptedContent,
	key: CryptoKey
): Promise<EncryptionResult> {
	// PLACEHOLDER: For now, just encode without encryption for UI development
	const encoded = new TextEncoder().encode(JSON.stringify(data));
	const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV for GCM

	// TODO: Uncomment for real encryption
	// const ciphertext = await crypto.subtle.encrypt(
	// 	{ name: 'AES-GCM', iv: iv },
	// 	key,
	// 	encoded
	// );

	// Placeholder: return unencrypted data
	const ciphertext = encoded.buffer;

	return { ciphertext, iv };
}

/**
 * Decrypt data using AES-256-GCM
 * @param ciphertext Encrypted data
 * @param iv Initialization vector
 * @param key CryptoKey for decryption
 * @returns Decrypted data
 */
export async function decryptData<T = DecryptedMetadata | DecryptedContent>(
	ciphertext: ArrayBuffer,
	iv: Uint8Array,
	key: CryptoKey
): Promise<T> {
	// PLACEHOLDER: For now, just decode without decryption
	// TODO: Uncomment for real decryption
	// const decrypted = await crypto.subtle.decrypt(
	// 	{ name: 'AES-GCM', iv: iv },
	// 	key,
	// 	ciphertext
	// );

	// Placeholder: treat as unencrypted data
	const decoded = new TextDecoder().decode(ciphertext);
	return JSON.parse(decoded) as T;
}

/**
 * Encrypt the Data Key with the Master Key
 * @param dataKey Data Key to encrypt
 * @param masterKey Master Key (KEK)
 * @returns Encrypted data key and IV
 */
export async function encryptDataKey(
	dataKey: CryptoKey,
	masterKey: CryptoKey
): Promise<EncryptionResult> {
	const exported = await crypto.subtle.exportKey('raw', dataKey);
	const iv = crypto.getRandomValues(new Uint8Array(12));

	const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, masterKey, exported);

	return { ciphertext, iv };
}

/**
 * Decrypt the Data Key with the Master Key
 * @param encryptedKey Encrypted data key
 * @param iv Initialization vector
 * @param masterKey Master Key (KEK)
 * @returns Decrypted Data Key
 */
export async function decryptDataKey(
	encryptedKey: ArrayBuffer,
	iv: Uint8Array | ArrayBuffer,
	masterKey: CryptoKey
): Promise<CryptoKey> {
	const decrypted = await crypto.subtle.decrypt(
		{ name: 'AES-GCM', iv: iv as BufferSource },
		masterKey,
		encryptedKey
	);

	return crypto.subtle.importKey('raw', decrypted, { name: 'AES-GCM', length: 256 }, true, [
		'encrypt',
		'decrypt'
	]);
}

/**
 * Initialize encryption system (for development, creates a dummy key)
 */
export async function initializeEncryption(): Promise<void> {
	const dummyKey = await generateDataKey();
	sessionKeyManager.setKey(dummyKey);
}

