import { openDatabase, type NotesDatabase } from '$lib/db';
import type { WebAuthnCredential } from '$lib/types';
import { sessionKeyManager } from './encryption';

/**
 * WebAuthn PRF extension for vault encryption
 *
 * This module provides passkey-based vault unlock using the WebAuthn PRF extension.
 * Each passkey stores an encrypted copy of the Data Key (DEK), encrypted with
 * a key derived from the PRF output.
 */

const WEBAUTHN_CREDENTIALS_KEY = 'webauthn_credentials';

/**
 * Check if WebAuthn is supported in this browser
 */
export function isWebAuthnSupported(): boolean {
	return (
		typeof window !== 'undefined' &&
		typeof window.PublicKeyCredential !== 'undefined' &&
		typeof navigator.credentials !== 'undefined'
	);
}

/**
 * Check if PRF extension is likely supported
 * Note: Actual support can only be confirmed during credential creation
 */
export async function isPRFSupported(): Promise<boolean> {
	if (!isWebAuthnSupported()) return false;

	try {
		// Check if the browser supports the PRF extension
		// This is a heuristic - actual support depends on the authenticator
		if (typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function') {
			return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
		}
		return true; // Assume supported if we can't check
	} catch {
		return false;
	}
}

/**
 * Convert ArrayBuffer to Base64 string
 */
export function bufferToBase64(buffer: ArrayBuffer): string {
	const bytes = new Uint8Array(buffer);
	let binary = '';
	for (let i = 0; i < bytes.byteLength; i++) {
		binary += String.fromCharCode(bytes[i]);
	}
	return btoa(binary);
}

/**
 * Convert Base64 string to ArrayBuffer
 */
export function base64ToBuffer(base64: string): ArrayBuffer {
	const binary = atob(base64);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.charCodeAt(i);
	}
	return bytes.buffer;
}

/**
 * Get vault credentials from database
 */
export async function getVaultCredentials(db: NotesDatabase): Promise<WebAuthnCredential[]> {
	const record = await db.settings.get(WEBAUTHN_CREDENTIALS_KEY);
	if (!record?.data) return [];
	return (record.data as { credentials: WebAuthnCredential[] }).credentials || [];
}

/**
 * Store vault credentials in database
 */
export async function storeVaultCredentials(
	db: NotesDatabase,
	credentials: WebAuthnCredential[]
): Promise<void> {
	await db.settings.put({
		id: WEBAUTHN_CREDENTIALS_KEY,
		data: { credentials }
	});
}

/**
 * Check if a vault has any registered passkeys
 */
export async function hasPasskeys(vaultId: string): Promise<boolean> {
	try {
		const db = openDatabase(vaultId);
		const credentials = await getVaultCredentials(db);
		db.close();
		return credentials.length > 0;
	} catch {
		return false;
	}
}

/**
 * Get the RP ID for WebAuthn (the domain)
 */
function getRpId(): string {
	return window.location.hostname;
}

/**
 * Convert BufferSource to ArrayBuffer
 */
function toArrayBuffer(buffer: BufferSource): ArrayBuffer {
	if (buffer instanceof ArrayBuffer) {
		return buffer;
	}
	// It's an ArrayBufferView
	return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}

/**
 * Derive an AES key from PRF output
 */
async function derivePRFKey(prfOutput: BufferSource): Promise<CryptoKey> {
	return crypto.subtle.importKey(
		'raw',
		toArrayBuffer(prfOutput),
		{ name: 'AES-GCM', length: 256 },
		false,
		['encrypt', 'decrypt']
	);
}

/**
 * Register a new passkey for a vault
 * @param vaultId Vault database name
 * @param dataKey The current Data Key (DEK) to encrypt
 * @param credentialName User-friendly name for this passkey
 * @returns The registered credential
 */
export async function registerPasskey(
	vaultId: string,
	dataKey: CryptoKey,
	credentialName: string
): Promise<WebAuthnCredential> {
	if (!isWebAuthnSupported()) {
		throw new Error('WebAuthn is not supported in this browser');
	}

	const db = openDatabase(vaultId);

	try {
		// Get existing credentials to exclude
		const existingCredentials = await getVaultCredentials(db);

		// Create the salt for PRF (using vaultId as domain separation)
		const prfSalt = new TextEncoder().encode(vaultId);

		// Create credential with PRF extension
		const credential = (await navigator.credentials.create({
			publicKey: {
				challenge: crypto.getRandomValues(new Uint8Array(32)),
				rp: {
					name: 'Gull Notes',
					id: getRpId()
				},
				user: {
					id: new TextEncoder().encode(vaultId),
					name: credentialName,
					displayName: credentialName
				},
				pubKeyCredParams: [
					{ type: 'public-key', alg: -7 }, // ES256
					{ type: 'public-key', alg: -257 } // RS256
				],
				authenticatorSelection: {
					residentKey: 'preferred',
					userVerification: 'required'
				},
				excludeCredentials: existingCredentials.map((c) => ({
					type: 'public-key' as const,
					id: base64ToBuffer(c.id)
				})),
				extensions: {
					prf: { eval: { first: prfSalt } }
				} as AuthenticationExtensionsClientInputs
			}
		})) as PublicKeyCredential | null;

		if (!credential) {
			throw new Error('Credential creation was cancelled');
		}

		// Check for PRF support in the response
		// During registration, PRF can return either:
		// - { enabled: true } - authenticator supports PRF but output only on auth
		// - { results: { first: <output> } } - PRF output available immediately
		const extensionResults =
			credential.getClientExtensionResults() as AuthenticationExtensionsClientOutputs & {
				prf?: { enabled?: boolean; results?: { first?: BufferSource } };
			};

		const prfData = extensionResults?.prf;
		if (!prfData) {
			throw new Error(
				"This authenticator doesn't support vault encryption (PRF extension not available)"
			);
		}

		// Check if PRF output is available directly, or if we need to authenticate
		let prfOutput: BufferSource | undefined = prfData.results?.first;

		if (!prfOutput && prfData.enabled) {
			// PRF is supported but output only available during authentication
			// We need to do an immediate authentication to get the PRF output

			const authAssertion = (await navigator.credentials.get({
				publicKey: {
					challenge: crypto.getRandomValues(new Uint8Array(32)),
					rpId: getRpId(),
					allowCredentials: [
						{
							type: 'public-key' as const,
							id: credential.rawId
						}
					],
					userVerification: 'required',
					extensions: {
						prf: { eval: { first: prfSalt } }
					} as AuthenticationExtensionsClientInputs
				}
			})) as PublicKeyCredential | null;

			if (!authAssertion) {
				throw new Error('Authentication for PRF was cancelled');
			}

			const authExtResults =
				authAssertion.getClientExtensionResults() as AuthenticationExtensionsClientOutputs & {
					prf?: { results?: { first?: BufferSource } };
				};
			prfOutput = authExtResults?.prf?.results?.first;
		}

		if (!prfOutput) {
			throw new Error(
				"This authenticator doesn't support vault encryption (PRF extension not available)"
			);
		}

		// Derive encryption key from PRF output
		const prfKey = await derivePRFKey(prfOutput);

		// Export and encrypt the Data Key
		const exportedDataKey = await crypto.subtle.exportKey('raw', dataKey);
		const iv = crypto.getRandomValues(new Uint8Array(12));
		const encryptedDataKey = await crypto.subtle.encrypt(
			{ name: 'AES-GCM', iv },
			prfKey,
			exportedDataKey
		);

		// Create credential record
		const newCredential: WebAuthnCredential = {
			id: bufferToBase64(credential.rawId),
			name: credentialName,
			createdAt: Date.now(),
			lastUsedAt: Date.now(),
			encryptedDataKey,
			dataKeyIv: iv
		};

		// Store updated credentials
		const updatedCredentials = [...existingCredentials, newCredential];
		await storeVaultCredentials(db, updatedCredentials);

		return newCredential;
	} finally {
		db.close();
	}
}

/**
 * Unlock a vault using a passkey
 * @param vaultId Vault database name
 * @returns The database instance if successful
 */
export async function unlockWithPasskey(vaultId: string): Promise<NotesDatabase> {
	if (!isWebAuthnSupported()) {
		throw new Error('WebAuthn is not supported in this browser');
	}

	const db = openDatabase(vaultId);

	try {
		const credentials = await getVaultCredentials(db);

		if (credentials.length === 0) {
			throw new Error('No passkeys registered for this vault');
		}

		// Create the salt for PRF (must match registration)
		const prfSalt = new TextEncoder().encode(vaultId);

		// Authenticate with any registered credential
		const assertion = (await navigator.credentials.get({
			publicKey: {
				challenge: crypto.getRandomValues(new Uint8Array(32)),
				rpId: getRpId(),
				allowCredentials: credentials.map((c) => ({
					type: 'public-key' as const,
					id: base64ToBuffer(c.id)
				})),
				userVerification: 'required',
				extensions: {
					prf: { eval: { first: prfSalt } }
				} as AuthenticationExtensionsClientInputs
			}
		})) as PublicKeyCredential | null;

		if (!assertion) {
			throw new Error('Authentication was cancelled');
		}

		// Find which credential was used
		const usedCredId = bufferToBase64(assertion.rawId);
		const usedCredential = credentials.find((c) => c.id === usedCredId);

		if (!usedCredential) {
			throw new Error('Unknown credential used');
		}

		// Get PRF output
		const extensionResults =
			assertion.getClientExtensionResults() as AuthenticationExtensionsClientOutputs & {
				prf?: { results?: { first?: BufferSource } };
			};
		const prfResults = extensionResults?.prf?.results;
		if (!prfResults?.first) {
			throw new Error('PRF extension failed');
		}

		// Derive decryption key from PRF output
		const prfKey = await derivePRFKey(prfResults.first);

		// Decrypt the Data Key
		let decryptedDataKey: ArrayBuffer;
		try {
			decryptedDataKey = await crypto.subtle.decrypt(
				{ name: 'AES-GCM', iv: new Uint8Array(usedCredential.dataKeyIv) },
				prfKey,
				usedCredential.encryptedDataKey
			);
		} catch {
			throw new Error('Failed to decrypt vault key');
		}

		// Import as CryptoKey
		const dataKey = await crypto.subtle.importKey(
			'raw',
			decryptedDataKey,
			{ name: 'AES-GCM', length: 256 },
			true,
			['encrypt', 'decrypt']
		);

		// Set session key
		sessionKeyManager.setKey(dataKey);

		// Update lastUsedAt for the used credential
		const updatedCredentials = credentials.map((c) =>
			c.id === usedCredId ? { ...c, lastUsedAt: Date.now() } : c
		);
		await storeVaultCredentials(db, updatedCredentials);

		return db;
	} catch (error) {
		db.close();
		throw error;
	}
}

/**
 * Remove a passkey from a vault
 * @param vaultId Vault database name
 * @param credentialId The credential ID to remove
 */
export async function removePasskey(vaultId: string, credentialId: string): Promise<void> {
	const db = openDatabase(vaultId);

	try {
		const credentials = await getVaultCredentials(db);
		const updatedCredentials = credentials.filter((c) => c.id !== credentialId);
		await storeVaultCredentials(db, updatedCredentials);
	} finally {
		db.close();
	}
}
