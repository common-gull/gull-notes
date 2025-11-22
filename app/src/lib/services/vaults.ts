import { openDatabase, type NotesDatabase } from '$lib/db';
import type { VaultInfo, VaultMetadata } from '$lib/types';
import {
	generateDataKey,
	deriveMasterKey,
	encryptDataKey,
	decryptDataKey,
	storeEncryptedDataKey,
	retrieveEncryptedDataKey,
	sessionKeyManager
} from './encryption';

/**
 * List all vaults by enumerating IndexedDB databases with 'vault_' prefix
 * @returns Array of vault information
 */
export async function listVaults(): Promise<VaultInfo[]> {
	if (!indexedDB.databases) {
		console.warn('indexedDB.databases() not supported in this browser');
		return [];
	}

	const databases = await indexedDB.databases();
	const vaultDbs = databases.filter((db) => db.name?.startsWith('vault_'));

	const vaults: VaultInfo[] = [];

	for (const dbInfo of vaultDbs) {
		if (!dbInfo.name) continue;

		try {
			// Open database to read metadata
			const db = openDatabase(dbInfo.name);
			const metadataRecord = await db.settings.get('vault_metadata');

			if (metadataRecord?.data) {
				const metadata = metadataRecord.data as VaultMetadata;
				vaults.push({
					id: dbInfo.name,
					name: metadata.name,
					createdAt: metadata.createdAt
				});
			}

			db.close();
		} catch (error) {
			console.error(`Failed to read metadata for vault ${dbInfo.name}:`, error);
		}
	}

	// Sort by creation date (newest first)
	return vaults.sort((a, b) => b.createdAt - a.createdAt);
}

/**
 * Create a new vault with password protection
 * @param vaultName User-friendly name for the vault
 * @param password Password to protect the vault
 * @returns Vault ID (database name)
 */
export async function createVault(vaultName: string, password: string): Promise<string> {
	// Generate unique vault ID
	const vaultId = `vault_${crypto.randomUUID()}`;

	// Generate random salt for password derivation
	const salt = crypto.getRandomValues(new Uint8Array(16));

	// Derive master key from password
	const masterKey = await deriveMasterKey(password, salt);

	// Generate random data key
	const dataKey = await generateDataKey();

	// Encrypt data key with master key
	const { ciphertext: encryptedKey, iv: keyIv } = await encryptDataKey(dataKey, masterKey);

	// Create database
	const db = openDatabase(vaultId);

	// Store vault metadata
	await db.settings.put({
		id: 'vault_metadata',
		data: {
			name: vaultName,
			createdAt: Date.now()
		} as VaultMetadata
	});

	// Store encrypted data key
	await storeEncryptedDataKey(db, encryptedKey, keyIv, salt);

	// Set data key in session
	sessionKeyManager.setKey(dataKey);

	db.close();

	return vaultId;
}

/**
 * Open/unlock a vault with password
 * @param vaultId Vault database name
 * @param password User password
 * @returns NotesDatabase instance if successful
 * @throws Error if password is incorrect or vault cannot be opened
 */
export async function openVault(vaultId: string, password: string): Promise<NotesDatabase> {
	const db = openDatabase(vaultId);

	// Retrieve encrypted data key
	const keyData = await retrieveEncryptedDataKey(db);
	if (!keyData) {
		throw new Error('Vault data key not found');
	}

	// Derive master key from password
	const masterKey = await deriveMasterKey(password, keyData.salt);

	try {
		// Try to decrypt data key with master key
		const dataKey = await decryptDataKey(keyData.encryptedKey, keyData.keyIv, masterKey);

		// Set data key in session
		sessionKeyManager.setKey(dataKey);

		return db;
	} catch (error) {
		db.close();
		throw new Error('Invalid password');
	}
}

/**
 * Delete a vault permanently
 * @param vaultId Vault database name
 */
export async function deleteVault(vaultId: string): Promise<void> {
	const databases = await indexedDB.databases();
	const exists = databases.some((db) => db.name === vaultId);
	
	if (!exists) {
		return; // Vault doesn't exist, nothing to delete
	}
	
	return new Promise<void>((resolve, reject) => {
		const request = indexedDB.deleteDatabase(vaultId);
		request.onsuccess = () => resolve();
		request.onerror = () => reject(request.error);
	});
}

/**
 * Get vault metadata
 * @param vaultId Vault database name
 * @returns Vault metadata or null if not found
 */
export async function getVaultMetadata(vaultId: string): Promise<VaultMetadata | null> {
	try {
		const db = openDatabase(vaultId);
		const metadataRecord = await db.settings.get('vault_metadata');
		db.close();
		return (metadataRecord?.data as VaultMetadata) || null;
	} catch (error) {
		console.error(`Failed to read metadata for vault ${vaultId}:`, error);
		return null;
	}
}

