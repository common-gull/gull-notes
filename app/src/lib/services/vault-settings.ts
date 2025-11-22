import type { NotesDatabase } from '$lib/db';
import type { VaultSettings } from '$lib/types';
import { encryptSettings, decryptSettings, sessionKeyManager } from './encryption';

/**
 * Default vault settings
 */
const DEFAULT_SETTINGS: VaultSettings = {
	inactivityTimeout: 15 // 15 minutes
};

/**
 * Get vault settings (decrypted)
 * @param db Database instance for the vault
 * @returns Vault settings or default if not found
 */
export async function getVaultSettings(db: NotesDatabase): Promise<VaultSettings> {
	const dataKey = sessionKeyManager.getKey();
	if (!dataKey) {
		throw new Error('Session key not available');
	}

	try {
		const record = await db.settings.get('vault_settings');
		if (!record?.data) {
			return DEFAULT_SETTINGS;
		}

		const encryptedData = record.data as {
			ciphertext: ArrayBuffer;
			iv: Uint8Array;
		};

		const settings = await decryptSettings<VaultSettings>(
			encryptedData.ciphertext,
			encryptedData.iv,
			dataKey
		);

		return settings;
	} catch (error) {
		console.error('Failed to load vault settings:', error);
		return DEFAULT_SETTINGS;
	}
}

/**
 * Update vault settings (encrypted)
 * @param db Database instance for the vault
 * @param settings Settings to save
 */
export async function updateVaultSettings(
	db: NotesDatabase,
	settings: VaultSettings
): Promise<void> {
	const dataKey = sessionKeyManager.getKey();
	if (!dataKey) {
		throw new Error('Session key not available');
	}

	const { ciphertext, iv } = await encryptSettings(settings, dataKey);

	await db.settings.put({
		id: 'vault_settings',
		data: {
			ciphertext,
			iv
		}
	});
}
