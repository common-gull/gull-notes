<script lang="ts">
	import { onMount } from 'svelte';
	import { listVaults } from '$lib/services/vaults';
	import type { VaultInfo } from '$lib/types';
	import Button from './ui/button/button.svelte';
	import { PlusIcon, DatabaseIcon } from 'lucide-svelte';

	interface Props {
		onSelectVault: (vaultId: string) => void;
		onCreateVault: () => void;
	}

	let { onSelectVault, onCreateVault }: Props = $props();

	let vaults = $state<VaultInfo[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);

	onMount(async () => {
		try {
			vaults = await listVaults();
		} catch (err) {
			console.error('Failed to load vaults:', err);
			error = 'Failed to load vaults';
		} finally {
			loading = false;
		}
	});

	function formatDate(timestamp: number): string {
		return new Date(timestamp).toLocaleDateString(undefined, {
			year: 'numeric',
			month: 'long',
			day: 'numeric'
		});
	}
</script>

<div class="fixed inset-0 z-50 bg-background flex items-center justify-center p-4">
	<div class="w-full max-w-2xl">
		<div class="text-center mb-8">
			<h1 class="text-5xl font-bold mb-4 bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">Gull Notes</h1>
			<h2 class="text-3xl font-semibold mb-2">Select a Vault</h2>
			<p class="text-muted-foreground">
				Choose a vault to unlock, or create a new one
			</p>
		</div>

		{#if loading}
			<div class="text-center py-12">
				<div class="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
				<p class="mt-4 text-muted-foreground">Loading vaults...</p>
			</div>
		{:else if error}
			<div class="bg-destructive/10 text-destructive rounded-lg p-4 mb-6">
				<p>{error}</p>
			</div>
		{:else if vaults.length === 0}
			<div class="text-center py-12 bg-muted/50 rounded-lg mb-6">
				<DatabaseIcon class="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
				<h2 class="text-xl font-semibold mb-2">No Vaults Found</h2>
				<p class="text-muted-foreground mb-6">
					Get started by creating your first encrypted vault
				</p>
			</div>
		{:else}
			<div class="space-y-3 mb-6 max-h-96 overflow-y-auto">
				{#each vaults as vault}
					<button
						onclick={() => onSelectVault(vault.id)}
						class="w-full p-4 bg-card hover:bg-accent rounded-lg border border-border transition-colors text-left flex items-center gap-4 group"
					>
						<div class="flex-shrink-0 w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center group-hover:bg-primary/20 transition-colors">
							<DatabaseIcon class="w-6 h-6 text-primary" />
						</div>
						<div class="flex-1 min-w-0">
							<h3 class="font-semibold text-lg truncate">{vault.name}</h3>
							<p class="text-sm text-muted-foreground">
								Created {formatDate(vault.createdAt)}
							</p>
						</div>
						<div class="flex-shrink-0">
							<span class="text-sm text-muted-foreground group-hover:text-foreground">
								Select →
							</span>
						</div>
					</button>
				{/each}
			</div>
		{/if}

		<Button onclick={onCreateVault} class="w-full" size="lg">
			<PlusIcon class="w-5 h-5 mr-2" />
			Create New Vault
		</Button>
	</div>
</div>

