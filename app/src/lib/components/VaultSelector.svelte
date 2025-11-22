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

<div class="fixed inset-0 z-50 flex items-center justify-center bg-background p-4">
	<div class="w-full max-w-2xl">
		<div class="mb-8 text-center">
			<h1
				class="mb-4 bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-5xl font-bold text-transparent"
			>
				Gull Notes
			</h1>
			<h2 class="mb-2 text-3xl font-semibold">Select a Vault</h2>
			<p class="text-muted-foreground">Choose a vault to unlock, or create a new one</p>
		</div>

		{#if loading}
			<div class="py-12 text-center">
				<div
					class="inline-block h-12 w-12 animate-spin rounded-full border-b-2 border-primary"
				></div>
				<p class="mt-4 text-muted-foreground">Loading vaults...</p>
			</div>
		{:else if error}
			<div class="mb-6 rounded-lg bg-destructive/10 p-4 text-destructive">
				<p>{error}</p>
			</div>
		{:else if vaults.length === 0}
			<div class="mb-6 rounded-lg bg-muted/50 py-12 text-center">
				<DatabaseIcon class="mx-auto mb-4 h-16 w-16 text-muted-foreground" />
				<h2 class="mb-2 text-xl font-semibold">No Vaults Found</h2>
				<p class="mb-6 text-muted-foreground">Get started by creating your first encrypted vault</p>
			</div>
		{:else}
			<div class="mb-6 max-h-96 space-y-3 overflow-y-auto">
				{#each vaults as vault (vault.id)}
					<button
						onclick={() => onSelectVault(vault.id)}
						class="group flex w-full items-center gap-4 rounded-lg border border-border bg-card p-4 text-left transition-colors hover:bg-accent"
					>
						<div
							class="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10 transition-colors group-hover:bg-primary/20"
						>
							<DatabaseIcon class="h-6 w-6 text-primary" />
						</div>
						<div class="min-w-0 flex-1">
							<h3 class="truncate text-lg font-semibold">{vault.name}</h3>
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
			<PlusIcon class="mr-2 h-5 w-5" />
			Create New Vault
		</Button>
	</div>
</div>
