import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
	deriveMasterKey,
	generateDataKey,
	encryptData,
	decryptData,
	encryptDataKey,
	decryptDataKey,
	encryptSettings,
	decryptSettings,
	sessionKeyManager,
	generateSalt
} from './encryption';
import type { DecryptedMetadata, DecryptedContent } from '../types';

describe('Encryption Service', () => {
	describe('generateSalt', () => {
		it('should generate 32-byte unique salts', () => {
			const salts = Array.from({ length: 10 }, () => generateSalt());

			// All should be 32 bytes
			salts.forEach((salt) => {
				expect(salt).toBeInstanceOf(Uint8Array);
				expect(salt.length).toBe(32);
			});

			// All should be unique
			const saltStrings = salts.map((s) => Array.from(s).join(','));
			expect(new Set(saltStrings).size).toBe(10);
		});
	});

	describe('deriveMasterKey', () => {
		const password = 'test-password-123';
		let salt: Uint8Array;

		beforeEach(() => {
			salt = generateSalt();
		});

		it('should derive a valid AES-GCM master key', async () => {
			const key = await deriveMasterKey(password, salt);
			expect(key).toBeInstanceOf(CryptoKey);
			expect(key.type).toBe('secret');
			expect(key.algorithm.name).toBe('AES-GCM');
		});

		it('should produce consistent keys for same password and salt', async () => {
			const key1 = await deriveMasterKey(password, salt);
			const key2 = await deriveMasterKey(password, salt);

			// Verify functional equivalence
			const testData = new TextEncoder().encode('test');
			const iv = crypto.getRandomValues(new Uint8Array(12));
			const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key1, testData);
			const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key2, encrypted);

			expect(new TextDecoder().decode(decrypted)).toBe('test');
		});

		it('should produce different keys for different salts', async () => {
			const salt1 = generateSalt();
			const salt2 = generateSalt();

			const key1 = await deriveMasterKey(password, salt1);
			const key2 = await deriveMasterKey(password, salt2);

			const testData = new TextEncoder().encode('test');
			const iv = crypto.getRandomValues(new Uint8Array(12));
			const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key1, testData);

			await expect(
				crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key2, encrypted)
			).rejects.toThrow();
		});

		it('should produce different keys for different passwords', async () => {
			const key1 = await deriveMasterKey('password1-abcdef', salt);
			const key2 = await deriveMasterKey('password2-ghijkl', salt);

			const testData = new TextEncoder().encode('test');
			const iv = crypto.getRandomValues(new Uint8Array(12));
			const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key1, testData);

			await expect(
				crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key2, encrypted)
			).rejects.toThrow();
		});

		describe('input validation', () => {
			it.each([
				['empty password', '', salt, 'non-empty string'],
				['short password', 'short', salt, 'at least 8 characters'],
				['null password', null, salt, 'non-empty string'],
				['undefined password', undefined, salt, 'non-empty string']
			])('should reject %s', async (_, pwd, s, expectedError) => {
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				await expect(deriveMasterKey(pwd as any, s as any)).rejects.toThrow(expectedError);
			});

			it.each([
				['empty salt', new Uint8Array(0), 'salt cannot be empty'],
				['null salt', null, 'salt is required']
			])('should reject %s', async (_, s, expectedError) => {
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				await expect(deriveMasterKey(password, s as any)).rejects.toThrow(expectedError);
			});

			it('should accept ArrayBuffer salt', async () => {
				const arrayBufferSalt = new Uint8Array(salt).buffer as ArrayBuffer;
				const key = await deriveMasterKey(password, arrayBufferSalt);
				expect(key).toBeInstanceOf(CryptoKey);
			});
		});
	});

	describe('generateDataKey', () => {
		it('should generate a valid extractable AES-256 key', async () => {
			const key = await generateDataKey();
			expect(key).toBeInstanceOf(CryptoKey);
			expect(key.type).toBe('secret');
			expect(key.algorithm.name).toBe('AES-GCM');
			expect((key.algorithm as AesKeyAlgorithm).length).toBe(256);
			expect(key.extractable).toBe(true);
		});

		it('should generate unique keys', async () => {
			const key1 = await generateDataKey();
			const key2 = await generateDataKey();

			const raw1 = await crypto.subtle.exportKey('raw', key1);
			const raw2 = await crypto.subtle.exportKey('raw', key2);

			expect(new Uint8Array(raw1)).not.toEqual(new Uint8Array(raw2));
		});
	});

	describe('encryptData / decryptData', () => {
		let key: CryptoKey;
		const testMetadata: DecryptedMetadata = {
			title: 'Test Note',
			tags: ['test', 'sample'],
			color: '#ff0000'
		};

		beforeEach(async () => {
			key = await generateDataKey();
		});

		it.each([
			['metadata', { title: 'Test Note', tags: ['test'], color: '#ff0000' }],
			['content', { body: 'This is test content with **markdown**' }],
			['unicode/emoji', { title: '测试 テスト', tags: ['emoji-😀', 'unicode-日本語'] }],
			['empty arrays', { title: 'Minimal', tags: [] }],
			['nested objects', { title: 'Nested', tags: [], nested: { deep: { value: 1 } } }]
		])('should encrypt and decrypt %s', async (_, data) => {
			const { ciphertext, iv } = await encryptData(data as DecryptedMetadata, key);

			expect(ciphertext).toBeInstanceOf(ArrayBuffer);
			expect(iv).toBeInstanceOf(Uint8Array);
			expect(iv.length).toBe(12);

			const decrypted = await decryptData(ciphertext, iv, key);
			expect(decrypted).toEqual(data);
		});

		it('should handle large data (1MB)', async () => {
			const largeContent: DecryptedContent = { body: 'x'.repeat(1024 * 1024) };
			const { ciphertext, iv } = await encryptData(largeContent, key);
			const decrypted = await decryptData<DecryptedContent>(ciphertext, iv, key);
			expect(decrypted.body.length).toBe(1024 * 1024);
		});

		describe('decryption failures', () => {
			it('should fail with wrong key', async () => {
				const { ciphertext, iv } = await encryptData(testMetadata, key);
				const wrongKey = await generateDataKey();
				await expect(decryptData(ciphertext, iv, wrongKey)).rejects.toThrow('Decryption failed');
			});

			it('should fail with wrong IV', async () => {
				const { ciphertext } = await encryptData(testMetadata, key);
				const wrongIv = crypto.getRandomValues(new Uint8Array(12));
				await expect(decryptData(ciphertext, wrongIv, key)).rejects.toThrow('Decryption failed');
			});

			it('should fail with modified ciphertext (GCM authentication)', async () => {
				const { ciphertext, iv } = await encryptData(testMetadata, key);
				const modified = new Uint8Array(ciphertext);
				modified[0] ^= 0xff;
				await expect(decryptData(modified.buffer, iv, key)).rejects.toThrow('Decryption failed');
			});
		});

		describe('input validation', () => {
			it.each([
				['null data', null, 'key', 'Data to encrypt cannot be null or undefined'],
				['undefined data', undefined, 'key', 'Data to encrypt cannot be null or undefined'],
				['null key', 'data', null, 'Encryption key is required']
			])('should reject %s for encryption', async (_, data, keyVal, expectedError) => {
				const k = keyVal === 'key' ? key : keyVal;
				const d = data === 'data' ? testMetadata : data;
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				await expect(encryptData(d as any, k as any)).rejects.toThrow(expectedError);
			});

			it.each([
				['null key', 'ciphertext', 'iv', null, 'Decryption key is required'],
				['empty ciphertext', new ArrayBuffer(0), 'iv', 'key', 'ciphertext cannot be empty'],
				['empty IV', 'ciphertext', new Uint8Array(0), 'key', 'iv cannot be empty']
			])('should reject %s for decryption', async (_, ct, ivVal, keyVal, expectedError) => {
				const { ciphertext, iv } = await encryptData(testMetadata, key);
				const c = ct === 'ciphertext' ? ciphertext : ct;
				const i = ivVal === 'iv' ? iv : ivVal;
				const k = keyVal === 'key' ? key : keyVal;
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				await expect(decryptData(c as any, i as any, k as any)).rejects.toThrow(expectedError);
			});
		});
	});

	describe('encryptDataKey / decryptDataKey', () => {
		let dataKey: CryptoKey;
		let masterKey: CryptoKey;

		beforeEach(async () => {
			dataKey = await generateDataKey();
			const salt = generateSalt();
			masterKey = await deriveMasterKey('test-password-123', salt);
		});

		it('should encrypt and decrypt data key', async () => {
			const { ciphertext, iv } = await encryptDataKey(dataKey, masterKey);

			expect(ciphertext).toBeInstanceOf(ArrayBuffer);
			expect(iv).toBeInstanceOf(Uint8Array);

			const decryptedKey = await decryptDataKey(ciphertext, iv, masterKey);

			// Verify functional equivalence
			const testData = new TextEncoder().encode('test');
			const testIv = crypto.getRandomValues(new Uint8Array(12));
			const encrypted = await crypto.subtle.encrypt(
				{ name: 'AES-GCM', iv: testIv },
				dataKey,
				testData
			);
			const decrypted = await crypto.subtle.decrypt(
				{ name: 'AES-GCM', iv: testIv },
				decryptedKey,
				encrypted
			);

			expect(new TextDecoder().decode(decrypted)).toBe('test');
		});

		it('should fail with wrong master key', async () => {
			const { ciphertext, iv } = await encryptDataKey(dataKey, masterKey);
			const wrongMasterKey = await deriveMasterKey('wrong-password', generateSalt());

			await expect(decryptDataKey(ciphertext, iv, wrongMasterKey)).rejects.toThrow(
				'Failed to decrypt data key'
			);
		});

		it.each([
			['null dataKey', null, 'masterKey', 'Both dataKey and masterKey are required'],
			['null masterKey', 'dataKey', null, 'Both dataKey and masterKey are required']
		])('should reject %s', async (_, dk, mk, expectedError) => {
			const d = dk === 'dataKey' ? dataKey : dk;
			const m = mk === 'masterKey' ? masterKey : mk;
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			await expect(encryptDataKey(d as any, m as any)).rejects.toThrow(expectedError);
		});

		it('should reject null encrypted key', async () => {
			const testIv = crypto.getRandomValues(new Uint8Array(12));
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			await expect(decryptDataKey(null as any, testIv, masterKey)).rejects.toThrow(
				'encryptedKey is required'
			);
		});
	});

	describe('encryptSettings / decryptSettings', () => {
		let key: CryptoKey;

		beforeEach(async () => {
			key = await generateDataKey();
		});

		it.each([
			['simple settings', { theme: 'dark', fontSize: 14 }],
			['nested settings', { level1: { level2: { value: 'deep', array: [1, 2, 3] } } }]
		])('should encrypt and decrypt %s', async (_, settings) => {
			const { ciphertext, iv } = await encryptSettings(settings, key);
			const decrypted = await decryptSettings<typeof settings>(ciphertext, iv, key);
			expect(decrypted).toEqual(settings);
		});

		it('should fail with wrong key', async () => {
			const settings = { theme: 'dark' };
			const { ciphertext, iv } = await encryptSettings(settings, key);
			const wrongKey = await generateDataKey();

			await expect(decryptSettings(ciphertext, iv, wrongKey)).rejects.toThrow('Decryption failed');
		});
	});

	describe('SessionKeyManager', () => {
		let testKey: CryptoKey;

		beforeEach(async () => {
			testKey = await generateDataKey();
			sessionKeyManager.clearKey();
		});

		afterEach(() => {
			sessionKeyManager.clearKey();
		});

		it('should manage key lifecycle correctly', async () => {
			// Initial state
			expect(sessionKeyManager.hasKey()).toBe(false);
			expect(sessionKeyManager.getKey()).toBeNull();

			// Set key
			sessionKeyManager.setKey(testKey);
			expect(sessionKeyManager.hasKey()).toBe(true);
			expect(sessionKeyManager.getKey()).toBe(testKey);

			// Clear key
			sessionKeyManager.clearKey();
			expect(sessionKeyManager.hasKey()).toBe(false);
			expect(sessionKeyManager.getKey()).toBeNull();
		});

		it('should update keyAvailable store reactively', () => {
			const values: boolean[] = [];
			const unsubscribe = sessionKeyManager.keyAvailable.subscribe((value) => {
				values.push(value);
			});

			sessionKeyManager.setKey(testKey);
			sessionKeyManager.clearKey();
			sessionKeyManager.setKey(testKey);

			unsubscribe();

			expect(values).toEqual([false, true, false, true]);
		});

		it('should overwrite existing key', async () => {
			const key1 = await generateDataKey();
			const key2 = await generateDataKey();

			sessionKeyManager.setKey(key1);
			expect(sessionKeyManager.getKey()).toBe(key1);

			sessionKeyManager.setKey(key2);
			expect(sessionKeyManager.getKey()).toBe(key2);
		});
	});

	describe('Security Properties', () => {
		it('should never reuse IVs across 1000 operations', async () => {
			const key = await generateDataKey();
			const testData: DecryptedMetadata = { title: 'Test', tags: [] };
			const ivSet = new Set<string>();

			for (let i = 0; i < 1000; i++) {
				const { iv } = await encryptData(testData, key);
				const ivString = Array.from(iv).join(',');
				expect(ivSet.has(ivString)).toBe(false);
				ivSet.add(ivString);
			}

			expect(ivSet.size).toBe(1000);
		});

		it('should produce cryptographically independent keys from different passwords', async () => {
			const salt = generateSalt();
			const key1 = await deriveMasterKey('password1234', salt);
			const key2 = await deriveMasterKey('password5678', salt);

			const testData = new TextEncoder().encode('test data for key isolation');
			const iv = crypto.getRandomValues(new Uint8Array(12));

			const encrypted1 = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key1, testData);
			const encrypted2 = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key2, testData);

			// Different keys produce different ciphertexts
			expect(new Uint8Array(encrypted1)).not.toEqual(new Uint8Array(encrypted2));

			// Cross-decryption should fail
			await expect(
				crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key1, encrypted2)
			).rejects.toThrow();
			await expect(
				crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key2, encrypted1)
			).rejects.toThrow();
		});

		it('should normalize error messages to prevent information leakage', async () => {
			const salt = generateSalt();
			const correctKey = await deriveMasterKey('correct-password-123', salt);
			const wrongKey = await deriveMasterKey('wrong-password-456', salt);
			const dataKey = await generateDataKey();

			const { ciphertext, iv } = await encryptDataKey(dataKey, correctKey);

			try {
				await decryptDataKey(ciphertext, iv, wrongKey);
				expect.fail('Should have thrown an error');
			} catch (error: unknown) {
				const message = (error as Error).message;
				expect(message).toBe('Failed to decrypt data key');
				expect(message).not.toContain('authentication');
				expect(message).not.toContain('OperationError');
			}
		});

		it('should handle concurrent operations safely', async () => {
			const key = await generateDataKey();

			// Concurrent encryptions
			const encrypted = await Promise.all(
				Array.from({ length: 50 }, (_, i) => encryptData({ title: `Note ${i}`, tags: [] }, key))
			);

			// All IVs unique
			const ivs = new Set(encrypted.map((r) => Array.from(r.iv).join(',')));
			expect(ivs.size).toBe(50);

			// Concurrent decryptions
			const decrypted = await Promise.all(
				encrypted.map((e) => decryptData<DecryptedMetadata>(e.ciphertext, e.iv, key))
			);

			decrypted.forEach((d, i) => {
				expect(d.title).toBe(`Note ${i}`);
			});
		});
	});
});
