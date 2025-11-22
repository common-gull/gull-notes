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

/**
 * List ALL IndexedDB databases (including non-vault ones) for recovery purposes
 * @returns Array of all database names
 */
export async function listAllDatabases(): Promise<string[]> {
	if (!indexedDB.databases) {
		console.warn('indexedDB.databases() not supported in this browser');
		return [];
	}

	const databases = await indexedDB.databases();
	return databases.map(db => db.name).filter((name): name is string => name !== undefined);
}

/**
 * Change vault password with full key rotation (safe copy-and-replace strategy)
 * @param vaultId Current vault database name
 * @param currentPassword Current password
 * @param newPassword New password
 * @param onProgress Optional progress callback (current, total)
 * @returns New vault ID
 * @throws Error if current password is incorrect or operation fails
 */
export async function changeVaultPassword(
	vaultId: string,
	currentPassword: string,
	newPassword: string,
	onProgress?: (current: number, total: number) => void
): Promise<string> {
	let oldVault: NotesDatabase | null = null;
	let newVault: NotesDatabase | null = null;
	let newVaultId: string | null = null;

	try {
		// Phase 1: Verification
		oldVault = openDatabase(vaultId);
		const oldKeyData = await retrieveEncryptedDataKey(oldVault);
		if (!oldKeyData) {
			throw new Error('Vault data key not found');
		}

		// Derive old master key and decrypt old data key
		const oldMasterKey = await deriveMasterKey(currentPassword, oldKeyData.salt);
		let oldDataKey: CryptoKey;
		try {
			oldDataKey = await decryptDataKey(oldKeyData.encryptedKey, oldKeyData.keyIv, oldMasterKey);
		} catch (error) {
			throw new Error('Current password is incorrect');
		}

		// Get vault metadata to preserve display name
		const metadata = await getVaultMetadata(vaultId);
		if (!metadata) {
			throw new Error('Vault metadata not found');
		}

		// Phase 2: Create New Vault
		newVaultId = `vault_${crypto.randomUUID()}_temp`;
		newVault = openDatabase(newVaultId);

		// Generate new data key
		const newDataKey = await generateDataKey();

		// Generate new salt and derive new master key
		const newSalt = crypto.getRandomValues(new Uint8Array(16));
		const newMasterKey = await deriveMasterKey(newPassword, newSalt);

		// Encrypt new data key with new master key
		const { ciphertext: newEncryptedKey, iv: newKeyIv } = await encryptDataKey(
			newDataKey,
			newMasterKey
		);

		// Store encrypted data key in new vault
		await storeEncryptedDataKey(newVault, newEncryptedKey, newKeyIv, newSalt);

		// Store vault metadata with same display name
		await newVault.settings.put({
			id: 'vault_metadata',
			data: {
				name: metadata.name,
				createdAt: metadata.createdAt
			} as VaultMetadata
		});

		// Phase 3: Copy & Re-encrypt (Paginated for memory efficiency)
		const total = await oldVault.notes.count();
		let processed = 0;

		// Import encryption functions
		const { encryptData, decryptData } = await import('./encryption');

		// Process notes in batches to keep memory usage low
		const batchSize = 50; // Process 50 notes at a time
		let offset = 0;

		while (offset < total) {
			// Load a batch of notes
			const batch = await oldVault.notes.offset(offset).limit(batchSize).toArray();

			// Process each note in the batch
			for (const encryptedNote of batch) {
				// Decrypt with old key
				const noteMetadata = await decryptData(
					encryptedNote.metaCipher,
					encryptedNote.metaIv,
					oldDataKey
				);
				const noteContent = await decryptData(
					encryptedNote.contentCipher,
					encryptedNote.contentIv,
					oldDataKey
				);

				// Encrypt with new key
				const newMeta = await encryptData(noteMetadata, newDataKey);
				const newContent = await encryptData(noteContent, newDataKey);

				// Store in new vault with same ID
				await newVault.notes.add({
					id: encryptedNote.id,
					metaCipher: newMeta.ciphertext,
					metaIv: newMeta.iv,
					contentCipher: newContent.ciphertext,
					contentIv: newContent.iv,
					createdAt: encryptedNote.createdAt,
					updatedAt: encryptedNote.updatedAt,
					schemaVersion: 1
				});

				processed++;
				onProgress?.(processed, total);
			}

			// Move to next batch
			offset += batchSize;
		}

		// Copy folder settings if they exist
		const folderSettings = await oldVault.settings.get('folders');
		if (folderSettings) {
			await newVault.settings.put(folderSettings);
		}

		// Phase 4: Verification
		// CRITICAL: Verify note count matches before proceeding
		const newVaultNoteCount = await newVault.notes.count();
		if (newVaultNoteCount !== total) {
			throw new Error(
				`Note count mismatch! Original: ${total}, New: ${newVaultNoteCount}. Aborting to prevent data loss.`
			);
		}

		// Verify all note IDs are present
		const oldNoteIds = new Set((await oldVault.notes.toArray()).map(n => n.id));
		const newNoteIds = new Set((await newVault.notes.toArray()).map(n => n.id));
		
		const missingIds = [...oldNoteIds].filter(id => !newNoteIds.has(id));
		if (missingIds.length > 0) {
			throw new Error(
				`Missing ${missingIds.length} note(s) in new vault! IDs: ${missingIds.join(', ')}. Aborting.`
			);
		}

		oldVault.close();
		oldVault = null;

		newVault.close();
		newVault = null;

		// Try to open new vault with new password
		const testVault = await openVault(newVaultId, newPassword);
		
		// Verify by decrypting a random sample of notes (or all if few)
		const notesToVerify = Math.min(5, total); // Verify up to 5 random notes
		if (notesToVerify > 0) {
			const allNotes = await testVault.notes.toArray();
			const testKey = sessionKeyManager.getKey();
			if (!testKey) {
				throw new Error('Session key not available after vault open');
			}

			// Test decrypt a sample of notes to ensure encryption worked
			for (let i = 0; i < notesToVerify; i++) {
				const randomIndex = Math.floor(Math.random() * allNotes.length);
				const testNote = allNotes[randomIndex];
				try {
					await decryptData(testNote.metaCipher, testNote.metaIv, testKey);
					await decryptData(testNote.contentCipher, testNote.contentIv, testKey);
				} catch (error) {
					throw new Error(
						`Failed to decrypt note ${testNote.id} in new vault. Encryption may have failed.`
					);
				}
			}
		}

		testVault.close();

		// Phase 5: Finalize
		// Delete old vault
		await deleteVault(vaultId);

		return newVaultId;
	} catch (error) {
		// Cleanup on error
		if (oldVault) {
			oldVault.close();
		}
		if (newVault) {
			newVault.close();
		}
		if (newVaultId) {
			// Delete temporary vault
			await deleteVault(newVaultId).catch(() => {
				// Ignore cleanup errors
			});
		}

		throw error;
	}
}

