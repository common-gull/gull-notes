import { describe, it, expect, afterEach } from 'vitest';
import { openDatabase } from '../db';
import {
	isWebAuthnSupported,
	bufferToBase64,
	base64ToBuffer,
	getVaultCredentials,
	storeVaultCredentials,
	hasPasskeys
} from './webauthn';
import { createVault, deleteVault } from './vaults';
import { sessionKeyManager } from './encryption';
import type { WebAuthnCredential } from '../types';

describe('WebAuthn Service', () => {
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

	describe('isWebAuthnSupported', () => {
		it('should return a boolean', () => {
			const result = isWebAuthnSupported();
			expect(typeof result).toBe('boolean');
		});

		it('should return true in browser environment with WebAuthn', () => {
			// In vitest browser mode, WebAuthn should be available
			// This test runs in chromium which has WebAuthn
			expect(isWebAuthnSupported()).toBe(true);
		});
	});

	describe('bufferToBase64 / base64ToBuffer', () => {
		it('should convert ArrayBuffer to base64 and back', () => {
			const original = new Uint8Array([1, 2, 3, 4, 5, 255, 0, 128]);
			const base64 = bufferToBase64(original.buffer);
			const restored = new Uint8Array(base64ToBuffer(base64));

			expect(restored).toEqual(original);
		});

		it('should handle empty buffer', () => {
			const original = new Uint8Array([]);
			const base64 = bufferToBase64(original.buffer);
			const restored = new Uint8Array(base64ToBuffer(base64));

			expect(restored).toEqual(original);
		});

		it('should handle large buffers', () => {
			const original = new Uint8Array(1000);
			crypto.getRandomValues(original);

			const base64 = bufferToBase64(original.buffer);
			const restored = new Uint8Array(base64ToBuffer(base64));

			expect(restored).toEqual(original);
		});

		it('should produce valid base64 string', () => {
			const data = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"
			const base64 = bufferToBase64(data.buffer);

			// Should only contain valid base64 characters
			expect(base64).toMatch(/^[A-Za-z0-9+/]*=*$/);
			expect(base64).toBe('SGVsbG8='); // "Hello" in base64
		});

		it('should handle binary data with all byte values', () => {
			const original = new Uint8Array(256);
			for (let i = 0; i < 256; i++) {
				original[i] = i;
			}

			const base64 = bufferToBase64(original.buffer);
			const restored = new Uint8Array(base64ToBuffer(base64));

			expect(restored).toEqual(original);
		});
	});

	describe('Credential Storage', () => {
		it('should store and retrieve credentials', async () => {
			const vaultId = await createVault('Test Vault', 'test-password-123');
			createdVaults.push(vaultId);

			const db = openDatabase(vaultId);

			const testCredential: WebAuthnCredential = {
				id: 'test-credential-id-base64',
				name: 'Test Passkey',
				createdAt: Date.now(),
				lastUsedAt: Date.now(),
				encryptedDataKey: new ArrayBuffer(32),
				dataKeyIv: new Uint8Array(12)
			};

			await storeVaultCredentials(db, [testCredential]);
			const retrieved = await getVaultCredentials(db);

			expect(retrieved.length).toBe(1);
			expect(retrieved[0].id).toBe(testCredential.id);
			expect(retrieved[0].name).toBe(testCredential.name);

			db.close();
		});

		it('should return empty array when no credentials exist', async () => {
			const vaultId = await createVault('Test Vault', 'test-password-123');
			createdVaults.push(vaultId);

			const db = openDatabase(vaultId);
			const credentials = await getVaultCredentials(db);

			expect(credentials).toEqual([]);

			db.close();
		});

		it('should store multiple credentials', async () => {
			const vaultId = await createVault('Test Vault', 'test-password-123');
			createdVaults.push(vaultId);

			const db = openDatabase(vaultId);

			const credentials: WebAuthnCredential[] = [
				{
					id: 'credential-1',
					name: 'YubiKey',
					createdAt: Date.now() - 1000,
					lastUsedAt: Date.now(),
					encryptedDataKey: new ArrayBuffer(32),
					dataKeyIv: new Uint8Array(12)
				},
				{
					id: 'credential-2',
					name: 'Touch ID',
					createdAt: Date.now(),
					lastUsedAt: Date.now(),
					encryptedDataKey: new ArrayBuffer(32),
					dataKeyIv: new Uint8Array(12)
				}
			];

			await storeVaultCredentials(db, credentials);
			const retrieved = await getVaultCredentials(db);

			expect(retrieved.length).toBe(2);
			expect(retrieved.map((c) => c.name).sort()).toEqual(['Touch ID', 'YubiKey']);

			db.close();
		});

		it('should overwrite credentials on store', async () => {
			const vaultId = await createVault('Test Vault', 'test-password-123');
			createdVaults.push(vaultId);

			const db = openDatabase(vaultId);

			// Store initial credentials
			await storeVaultCredentials(db, [
				{
					id: 'old-credential',
					name: 'Old Key',
					createdAt: Date.now(),
					lastUsedAt: Date.now(),
					encryptedDataKey: new ArrayBuffer(32),
					dataKeyIv: new Uint8Array(12)
				}
			]);

			// Store new credentials (should replace)
			await storeVaultCredentials(db, [
				{
					id: 'new-credential',
					name: 'New Key',
					createdAt: Date.now(),
					lastUsedAt: Date.now(),
					encryptedDataKey: new ArrayBuffer(32),
					dataKeyIv: new Uint8Array(12)
				}
			]);

			const retrieved = await getVaultCredentials(db);

			expect(retrieved.length).toBe(1);
			expect(retrieved[0].id).toBe('new-credential');

			db.close();
		});
	});

	describe('hasPasskeys', () => {
		it('should return false for vault without passkeys', async () => {
			const vaultId = await createVault('Test Vault', 'test-password-123');
			createdVaults.push(vaultId);

			const result = await hasPasskeys(vaultId);
			expect(result).toBe(false);
		});

		it('should return true for vault with passkeys', async () => {
			const vaultId = await createVault('Test Vault', 'test-password-123');
			createdVaults.push(vaultId);

			// Add a credential
			const db = openDatabase(vaultId);
			await storeVaultCredentials(db, [
				{
					id: 'test-credential',
					name: 'Test Key',
					createdAt: Date.now(),
					lastUsedAt: Date.now(),
					encryptedDataKey: new ArrayBuffer(32),
					dataKeyIv: new Uint8Array(12)
				}
			]);
			db.close();

			const result = await hasPasskeys(vaultId);
			expect(result).toBe(true);
		});

		it('should return false for non-existent vault', async () => {
			const result = await hasPasskeys('vault_nonexistent');
			expect(result).toBe(false);
		});
	});

	describe('Credential Data Integrity', () => {
		it('should preserve encrypted data key bytes', async () => {
			const vaultId = await createVault('Test Vault', 'test-password-123');
			createdVaults.push(vaultId);

			const db = openDatabase(vaultId);

			// Create test data with known bytes
			const encryptedKey = new Uint8Array(32);
			crypto.getRandomValues(encryptedKey);
			const iv = new Uint8Array(12);
			crypto.getRandomValues(iv);

			const credential: WebAuthnCredential = {
				id: 'test-id',
				name: 'Test',
				createdAt: Date.now(),
				lastUsedAt: Date.now(),
				encryptedDataKey: encryptedKey.buffer,
				dataKeyIv: iv
			};

			await storeVaultCredentials(db, [credential]);
			const [retrieved] = await getVaultCredentials(db);

			// Verify the bytes are preserved
			const retrievedKey = new Uint8Array(retrieved.encryptedDataKey);
			const retrievedIv = new Uint8Array(retrieved.dataKeyIv);

			expect(retrievedKey).toEqual(encryptedKey);
			expect(retrievedIv).toEqual(iv);

			db.close();
		});

		it('should preserve timestamps', async () => {
			const vaultId = await createVault('Test Vault', 'test-password-123');
			createdVaults.push(vaultId);

			const db = openDatabase(vaultId);

			const createdAt = Date.now() - 86400000; // 1 day ago
			const lastUsedAt = Date.now();

			const credential: WebAuthnCredential = {
				id: 'test-id',
				name: 'Test',
				createdAt,
				lastUsedAt,
				encryptedDataKey: new ArrayBuffer(32),
				dataKeyIv: new Uint8Array(12)
			};

			await storeVaultCredentials(db, [credential]);
			const [retrieved] = await getVaultCredentials(db);

			expect(retrieved.createdAt).toBe(createdAt);
			expect(retrieved.lastUsedAt).toBe(lastUsedAt);

			db.close();
		});
	});
});
