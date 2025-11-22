import { writable, derived, get } from 'svelte/store';
import type { VaultInfo } from '$lib/types';
import type { NotesDatabase } from '$lib/db';
import { openVault, getVaultMetadata } from '$lib/services/vaults';
import { sessionKeyManager } from '$lib/services/encryption';
import { getVaultSettings } from '$lib/services/vault-settings';
import { startMonitoring, stopMonitoring } from './inactivity';

interface VaultState {
	selectedVaultForUnlock: VaultInfo | null;
	activeVault: VaultInfo | null;
	activeDatabase: NotesDatabase | null;
}

const initialState: VaultState = {
	selectedVaultForUnlock: null,
	activeVault: null,
	activeDatabase: null
};

const vaultState = writable<VaultState>(initialState);

/**
 * Select a vault for unlocking
 */
export function selectVaultForUnlock(vault: VaultInfo): void {
	vaultState.update((state) => ({
		...state,
		selectedVaultForUnlock: vault
	}));
}

/**
 * Clear vault selection
 */
export function clearVaultSelection(): void {
	vaultState.update((state) => ({
		...state,
		selectedVaultForUnlock: null
	}));
}

/**
 * Unlock a vault and set it as active
 */
export async function unlockVault(vaultId: string, password: string): Promise<NotesDatabase> {
	const db = await openVault(vaultId, password);
	const metadata = await getVaultMetadata(vaultId);

	if (!metadata) {
		throw new Error('Vault metadata not found');
	}

	const vaultInfo: VaultInfo = {
		id: vaultId,
		name: metadata.name,
		createdAt: metadata.createdAt
	};

	vaultState.update((state) => ({
		...state,
		selectedVaultForUnlock: null, // Clear selection after unlock
		activeVault: vaultInfo,
		activeDatabase: db
	}));

	// Load vault settings and start inactivity monitoring
	try {
		const settings = await getVaultSettings(db);
		startMonitoring(settings.inactivityTimeout);
	} catch (error) {
		console.error('Failed to load vault settings for inactivity monitoring:', error);
		// Continue even if settings load fails
	}

	return db;
}

/**
 * Lock the current vault
 */
export function lockVault(): void {
	const state = get(vaultState);

	// Stop inactivity monitoring
	stopMonitoring();

	// Clear session key
	sessionKeyManager.clearKey();

	// Close database if open
	if (state.activeDatabase) {
		state.activeDatabase.close();
	}

	// Reset state
	vaultState.set(initialState);
}

/**
 * Create and activate a new vault
 */
export function activateVault(
	vaultId: string,
	vaultName: string,
	createdAt: number,
	db: NotesDatabase
): void {
	const vaultInfo: VaultInfo = {
		id: vaultId,
		name: vaultName,
		createdAt
	};

	vaultState.update((state) => ({
		...state,
		selectedVaultForUnlock: null,
		activeVault: vaultInfo,
		activeDatabase: db
	}));

	// Load vault settings and start inactivity monitoring for new vaults
	getVaultSettings(db)
		.then((settings) => {
			startMonitoring(settings.inactivityTimeout);
		})
		.catch((error) => {
			console.error('Failed to load vault settings for inactivity monitoring:', error);
		});
}

// Export individual stores
export const selectedVaultForUnlock = derived(
	vaultState,
	($state) => $state.selectedVaultForUnlock
);
export const activeVault = derived(vaultState, ($state) => $state.activeVault);
export const activeDatabase = derived(vaultState, ($state) => $state.activeDatabase);
