<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import VaultSelector from '$lib/components/VaultSelector.svelte';
	import { activeVault, selectVaultForUnlock } from '$lib/stores/vault';
	import { getVaultMetadata } from '$lib/services/vaults';

	// If already unlocked, redirect to vault
	onMount(() => {
		if ($activeVault) {
			goto('/vault');
		}
	});

	async function handleSelectVault(vaultId: string) {
		const metadata = await getVaultMetadata(vaultId);
		if (metadata) {
			selectVaultForUnlock({
				id: vaultId,
				name: metadata.name,
				createdAt: metadata.createdAt
			});
			await goto('/vault/unlock');
		}
	}

	async function handleCreateVault() {
		await goto('/vault/create');
	}
</script>

<VaultSelector onSelectVault={handleSelectVault} onCreateVault={handleCreateVault} />
