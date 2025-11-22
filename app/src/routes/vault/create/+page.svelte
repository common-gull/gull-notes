<script lang="ts">
	import { goto } from '$app/navigation';
	import CreateVaultDialog from '$lib/components/CreateVaultDialog.svelte';
	import { activateVault } from '$lib/stores/vault';
	import { setupDatabaseHooks } from '$lib/stores/notes';
	import type { NotesDatabase } from '$lib/db';

	async function handleVaultCreated(vaultId: string, db: NotesDatabase) {
		// Get vault metadata to extract name and created date
		const { getVaultMetadata } = await import('$lib/services/vaults');
		const metadata = await getVaultMetadata(vaultId);
		
		if (!metadata) {
			console.error('Failed to get vault metadata');
			await goto('/');
			return;
		}

		// Activate vault in store
		activateVault(vaultId, metadata.name, metadata.createdAt, db);
		
		// Set up database hooks (activeDatabase is set automatically via store subscription)
		setupDatabaseHooks(db);
		
		// Navigate to vault
		await goto('/vault');
	}

	async function handleCancel() {
		await goto('/');
	}
</script>

<CreateVaultDialog onCreated={handleVaultCreated} onCancel={handleCancel} />

