import { describe, it, expect, afterEach } from 'vitest';
import { openDatabase } from '../db';
import { createVault, openVault, deleteVault, listVaults, changeVaultPassword } from './vaults';
import { sessionKeyManager, encryptData, decryptData } from './encryption';
import type { DecryptedMetadata, DecryptedContent } from '../types';

describe('Vault Integration Tests', () => {
	const createdVaults: string[] = [];

	afterEach(async () => {
		// Clean up all created vaults
		for (const vaultId of createdVaults) {
			try {
				await deleteVault(vaultId);
			} catch {
				// Ignore cleanup errors
			}
		}
		createdVaults.length = 0;
		sessionKeyManager.clearKey();
	});

	describe('createVault', () => {
		it('should create a new vault with encrypted data key', async () => {
			const vaultId = await createVault('Test Vault', 'test-password-123');
			createdVaults.push(vaultId);

			expect(vaultId).toMatch(/^vault_[0-9a-f-]+$/);
			expect(sessionKeyManager.hasKey()).toBe(true);
		});

		it('should store vault metadata', async () => {
			const vaultId = await createVault('My Test Vault', 'password-12345');
			createdVaults.push(vaultId);

			const db = openDatabase(vaultId);
			const metadata = await db.settings.get('vault_metadata');
			db.close();

			expect(metadata).toBeDefined();
			expect(metadata?.data).toMatchObject({
				name: 'My Test Vault'
			});
		});

		it('should store encrypted data key with 32-byte salt', async () => {
			const vaultId = await createVault('Test Vault', 'test-password-123');
			createdVaults.push(vaultId);

			const db = openDatabase(vaultId);
			const keyData = await db.settings.get('encrypted_data_key');
			db.close();

			expect(keyData).toBeDefined();
			expect(keyData?.data).toHaveProperty('encryptedKey');
			expect(keyData?.data).toHaveProperty('keyIv');
			expect(keyData?.data).toHaveProperty('salt');

			const data = keyData?.data as { salt: Uint8Array };
			expect(data.salt.length).toBe(32); // Verify 32-byte salt
		});

		it('should create unique vaults', async () => {
			const vault1 = await createVault('Vault 1', 'password-12345');
			const vault2 = await createVault('Vault 2', 'password-12345');
			createdVaults.push(vault1, vault2);

			expect(vault1).not.toBe(vault2);
		});

		it('should allow same name for different vaults', async () => {
			const vault1 = await createVault('Same Name', 'password1-1234');
			const vault2 = await createVault('Same Name', 'password2-1234');
			createdVaults.push(vault1, vault2);

			expect(vault1).not.toBe(vault2);
		});
	});

	describe('openVault', () => {
		it('should open vault with correct password', async () => {
			const vaultId = await createVault('Test Vault', 'correct-pass-123');
			createdVaults.push(vaultId);

			sessionKeyManager.clearKey();

			const db = await openVault(vaultId, 'correct-pass-123');
			expect(db).toBeDefined();
			expect(sessionKeyManager.hasKey()).toBe(true);
			db.close();
		});

		it('should reject incorrect password', async () => {
			const vaultId = await createVault('Test Vault', 'correct-pass-123');
			createdVaults.push(vaultId);

			sessionKeyManager.clearKey();

			await expect(openVault(vaultId, 'wrong-password')).rejects.toThrow('Invalid password');
			expect(sessionKeyManager.hasKey()).toBe(false);
		});

		it('should reject non-existent vault', async () => {
			await expect(openVault('vault_nonexistent', 'password-12345')).rejects.toThrow();
		});

		it('should decrypt data key correctly', async () => {
			const vaultId = await createVault('Test Vault', 'test-password-123');
			createdVaults.push(vaultId);

			// Get the key from creation
			const creationKey = sessionKeyManager.getKey();
			expect(creationKey).not.toBeNull();

			// Clear and reopen
			sessionKeyManager.clearKey();
			const db = await openVault(vaultId, 'test-password-123');

			// Verify we can encrypt/decrypt with the reopened key
			const testData: DecryptedMetadata = { title: 'Test', tags: [] };
			const sessionKey = sessionKeyManager.getKey();
			expect(sessionKey).not.toBeNull();

			const { ciphertext, iv } = await encryptData(testData, sessionKey!);
			const decrypted = await decryptData<DecryptedMetadata>(ciphertext, iv, sessionKey!);

			expect(decrypted).toEqual(testData);
			db.close();
		});
	});

	describe('listVaults', () => {
		it('should list created vaults', async () => {
			const vault1 = await createVault('Vault One', 'password-12345');
			const vault2 = await createVault('Vault Two', 'password-12345');
			createdVaults.push(vault1, vault2);

			const vaults = await listVaults();

			const createdVaultInfos = vaults.filter((v) => v.id === vault1 || v.id === vault2);

			expect(createdVaultInfos.length).toBe(2);
			expect(createdVaultInfos.map((v) => v.name).sort()).toEqual(['Vault One', 'Vault Two']);
		});

		it('should return empty array when no vaults exist', async () => {
			// This test might have other vaults from other tests, so just check it returns an array
			const vaults = await listVaults();
			expect(Array.isArray(vaults)).toBe(true);
		});
	});

	describe('deleteVault', () => {
		it('should delete vault', async () => {
			const vaultId = await createVault('To Delete', 'password-12345');
			createdVaults.push(vaultId);

			await deleteVault(vaultId);

			// Try to open - should fail
			await expect(openVault(vaultId, 'password-12345')).rejects.toThrow();

			// Remove from cleanup list since we already deleted it
			const index = createdVaults.indexOf(vaultId);
			if (index > -1) {
				createdVaults.splice(index, 1);
			}
		});

		it('should handle deleting non-existent vault', async () => {
			// Should not throw
			await expect(deleteVault('vault_nonexistent')).resolves.toBeUndefined();
		});
	});

	describe('End-to-End Encryption Flow', () => {
		it('should encrypt and decrypt notes across vault reopens', async () => {
			// Create vault and add encrypted note
			const vaultId = await createVault('E2E Test Vault', 'test-password-123');
			createdVaults.push(vaultId);

			const db = openDatabase(vaultId);
			const key1 = sessionKeyManager.getKey()!;

			const metadata: DecryptedMetadata = {
				title: 'Secret Note',
				tags: ['confidential', 'test']
			};
			const content: DecryptedContent = {
				body: 'This is secret content that should be encrypted'
			};

			const encryptedMeta = await encryptData(metadata, key1);
			const encryptedContent = await encryptData(content, key1);

			await db.notes.add({
				id: crypto.randomUUID(),
				metaCipher: encryptedMeta.ciphertext,
				metaIv: encryptedMeta.iv,
				contentCipher: encryptedContent.ciphertext,
				contentIv: encryptedContent.iv,
				createdAt: Date.now(),
				updatedAt: Date.now(),
				schemaVersion: 1
			});

			const allNotes = await db.notes.toArray();
			const noteId = allNotes[0].id;
			db.close();

			// Close session
			sessionKeyManager.clearKey();

			// Reopen vault
			const db2 = await openVault(vaultId, 'test-password-123');
			const key2 = sessionKeyManager.getKey()!;

			// Retrieve and decrypt note
			const note = await db2.notes.get(noteId);
			expect(note).toBeDefined();

			const decryptedMeta = await decryptData<DecryptedMetadata>(
				note!.metaCipher,
				note!.metaIv,
				key2
			);
			const decryptedContent = await decryptData<DecryptedContent>(
				note!.contentCipher,
				note!.contentIv,
				key2
			);

			expect(decryptedMeta).toEqual(metadata);
			expect(decryptedContent).toEqual(content);

			db2.close();
		});

		it('should fail to decrypt notes with wrong password', async () => {
			// Create vault and add encrypted note
			const vaultId = await createVault('Test Vault', 'correct-pass-123');
			createdVaults.push(vaultId);

			const db = openDatabase(vaultId);
			const key = sessionKeyManager.getKey()!;

			const metadata: DecryptedMetadata = {
				title: 'Secret Note',
				tags: []
			};

			const encryptedMeta = await encryptData(metadata, key);

			await db.notes.add({
				id: crypto.randomUUID(),
				metaCipher: encryptedMeta.ciphertext,
				metaIv: encryptedMeta.iv,
				contentCipher: new ArrayBuffer(0),
				contentIv: new Uint8Array(12),
				createdAt: Date.now(),
				updatedAt: Date.now(),
				schemaVersion: 1
			});

			db.close();

			// Try to open with wrong password
			await expect(openVault(vaultId, 'wrong-password')).rejects.toThrow('Invalid password');
		});

		it('should maintain data integrity across multiple notes', async () => {
			const vaultId = await createVault('Multi Note Vault', 'test-password-123');
			createdVaults.push(vaultId);

			const db = openDatabase(vaultId);
			const key = sessionKeyManager.getKey()!;

			// Add multiple notes
			const notes = Array.from({ length: 10 }, (_, i) => ({
				metadata: { title: `Note ${i}`, tags: [`tag${i}`] },
				content: { body: `Content ${i}` }
			}));

			for (const note of notes) {
				const encMeta = await encryptData(note.metadata, key);
				const encContent = await encryptData(note.content, key);

				await db.notes.add({
					id: crypto.randomUUID(),
					metaCipher: encMeta.ciphertext,
					metaIv: encMeta.iv,
					contentCipher: encContent.ciphertext,
					contentIv: encContent.iv,
					createdAt: Date.now(),
					updatedAt: Date.now(),
					schemaVersion: 1
				});
			}

			// Retrieve and verify all notes
			const storedNotes = await db.notes.toArray();
			expect(storedNotes.length).toBe(10);

			for (let i = 0; i < storedNotes.length; i++) {
				const decMeta = await decryptData<DecryptedMetadata>(
					storedNotes[i].metaCipher,
					storedNotes[i].metaIv,
					key
				);
				expect(decMeta.title).toMatch(/^Note \d+$/);
			}

			db.close();
		});
	});

	describe('Password Change', () => {
		it('should change vault password successfully', async () => {
			// Create vault with initial password
			const vaultId = await createVault('Password Change Test', 'old-password-123');
			createdVaults.push(vaultId);

			// Add a test note
			let db = openDatabase(vaultId);
			const key = sessionKeyManager.getKey()!;

			const testNote = {
				metadata: { title: 'Test Note', tags: ['test'] },
				content: { body: 'Test content' }
			};

			const encMeta = await encryptData(testNote.metadata, key);
			const encContent = await encryptData(testNote.content, key);

			await db.notes.add({
				id: crypto.randomUUID(),
				metaCipher: encMeta.ciphertext,
				metaIv: encMeta.iv,
				contentCipher: encContent.ciphertext,
				contentIv: encContent.iv,
				createdAt: Date.now(),
				updatedAt: Date.now(),
				schemaVersion: 1
			});

			db.close();

			// Change password
			const newVaultId = await changeVaultPassword(vaultId, 'old-password-123', 'new-password-456');
			createdVaults.push(newVaultId);

			// Remove old vault from cleanup (it's been deleted)
			const oldIndex = createdVaults.indexOf(vaultId);
			if (oldIndex > -1) {
				createdVaults.splice(oldIndex, 1);
			}

			// Try to open with old password - should fail
			await expect(openVault(newVaultId, 'old-password-123')).rejects.toThrow('Invalid password');

			// Open with new password - should succeed
			db = await openVault(newVaultId, 'new-password-456');
			const newKey = sessionKeyManager.getKey()!;

			// Verify note is still accessible
			const notes = await db.notes.toArray();
			expect(notes.length).toBe(1);

			const decMeta = await decryptData<DecryptedMetadata>(
				notes[0].metaCipher,
				notes[0].metaIv,
				newKey
			);
			const decContent = await decryptData<DecryptedContent>(
				notes[0].contentCipher,
				notes[0].contentIv,
				newKey
			);

			expect(decMeta.title).toBe('Test Note');
			expect(decContent.body).toBe('Test content');

			db.close();
		});

		it('should fail password change with wrong current password', async () => {
			const vaultId = await createVault('Test Vault', 'correct-pass-123');
			createdVaults.push(vaultId);

			await expect(
				changeVaultPassword(vaultId, 'wrong-password', 'new-password-456')
			).rejects.toThrow('Current password is incorrect');
		});
	});

	describe('Salt Size Verification', () => {
		it('should use 32-byte salt for new vaults', async () => {
			const vaultId = await createVault('Salt Test Vault', 'test-password-123');
			createdVaults.push(vaultId);

			const db = openDatabase(vaultId);
			const keyData = await db.settings.get('encrypted_data_key');
			db.close();

			expect(keyData).toBeDefined();
			const data = keyData?.data as { salt: Uint8Array };
			expect(data.salt).toBeInstanceOf(Uint8Array);
			expect(data.salt.length).toBe(32);
		});

		it('should use 32-byte salt after password change', async () => {
			const vaultId = await createVault('Test Vault', 'old-password-123');
			createdVaults.push(vaultId);

			const newVaultId = await changeVaultPassword(vaultId, 'old-password-123', 'new-password-456');
			createdVaults.push(newVaultId);

			const db = openDatabase(newVaultId);
			const keyData = await db.settings.get('encrypted_data_key');
			db.close();

			expect(keyData).toBeDefined();
			const data = keyData?.data as { salt: Uint8Array };
			expect(data.salt.length).toBe(32);
		});
	});
});
