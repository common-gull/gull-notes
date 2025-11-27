<script lang="ts">
	import { onMount } from 'svelte';
	import { listVaults, importVault } from '$lib/services/vaults';
	import type { VaultInfo } from '$lib/types';
	import Button from './ui/button/button.svelte';
	import { Input } from './ui/input';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import DatabaseIcon from '@lucide/svelte/icons/database';
	import Upload from '@lucide/svelte/icons/upload';
	import EyeIcon from '@lucide/svelte/icons/eye';
	import EyeOffIcon from '@lucide/svelte/icons/eye-off';
	import { t } from '$lib/i18n';

	interface Props {
		onSelectVault: (vaultId: string) => void;
		onCreateVault: () => void;
	}

	let { onSelectVault, onCreateVault }: Props = $props();

	let vaults = $state<VaultInfo[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);

	// Import state
	let showImportDialog = $state(false);
	let importFile = $state<File | null>(null);
	let importPassword = $state('');
	let importVaultName = $state('');
	let showImportPassword = $state(false);
	let importing = $state(false);
	let importError = $state<string | null>(null);

	onMount(async () => {
		try {
			vaults = await listVaults();
		} catch (err) {
			console.error('Failed to load vaults:', err);
			error = $t('vault.failedToLoad');
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

	function handleFileSelect(event: Event) {
		const target = event.target as HTMLInputElement;
		if (target.files && target.files[0]) {
			importFile = target.files[0];
			importError = null;
		}
	}

	async function handleImport() {
		if (!importFile || !importPassword) return;

		importing = true;
		importError = null;

		try {
			const blob = importFile;
			const newVaultId = await importVault(blob, importPassword, importVaultName || undefined);

			// Refresh vault list
			vaults = await listVaults();

			// Reset import form
			showImportDialog = false;
			importFile = null;
			importPassword = '';
			importVaultName = '';

			// Navigate to the imported vault
			onSelectVault(newVaultId);
		} catch (err) {
			console.error('Failed to import vault:', err);
			const errorMessage =
				err instanceof Error ? err.message : $t('vault.importDialog.failedToImport');

			if (errorMessage.includes('Invalid password')) {
				importError = $t('vault.importDialog.incorrectPassword');
			} else {
				importError = errorMessage;
			}
		} finally {
			importing = false;
		}
	}
</script>

<div class="fixed inset-0 z-50 flex items-center justify-center bg-background p-4">
	<div class="w-full max-w-2xl">
		<div class="mb-8 text-center">
			<h1
				class="mb-4 bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-5xl font-bold text-transparent"
			>
				{$t('common.appName')}
			</h1>
			<h2 class="mb-2 text-3xl font-semibold">{$t('vault.selectTitle')}</h2>
			<p class="text-muted-foreground">{$t('vault.selectDescription')}</p>
		</div>

		{#if loading}
			<div class="py-12 text-center">
				<div
					class="inline-block h-12 w-12 animate-spin rounded-full border-b-2 border-primary"
				></div>
				<p class="mt-4 text-muted-foreground">{$t('vault.loadingVaults')}</p>
			</div>
		{:else if error}
			<div class="mb-6 rounded-lg bg-destructive/10 p-4 text-destructive">
				<p>{error}</p>
			</div>
		{:else if vaults.length === 0}
			<div class="mb-6 rounded-lg bg-muted/50 py-12 text-center">
				<DatabaseIcon class="mx-auto mb-4 h-16 w-16 text-muted-foreground" />
				<h2 class="mb-2 text-xl font-semibold">{$t('vault.noVaultsFound')}</h2>
				<p class="mb-6 text-muted-foreground">{$t('vault.noVaultsDescription')}</p>
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
								{$t('vault.created', { date: formatDate(vault.createdAt) })}
							</p>
						</div>
						<div class="flex-shrink-0">
							<span class="text-sm text-muted-foreground group-hover:text-foreground">
								{$t('vault.select')}
							</span>
						</div>
					</button>
				{/each}
			</div>
		{/if}

		<div class="flex gap-3">
			<Button onclick={() => (showImportDialog = true)} variant="outline" class="flex-1" size="lg">
				<Upload class="mr-2 h-5 w-5" />
				{$t('vault.importVault')}
			</Button>
			<Button onclick={onCreateVault} class="flex-1" size="lg">
				<PlusIcon class="mr-2 h-5 w-5" />
				{$t('vault.createNew')}
			</Button>
		</div>
	</div>
</div>

<!-- Import Dialog -->
{#if showImportDialog}
	<div
		role="dialog"
		aria-modal="true"
		aria-labelledby="import-dialog-title"
		tabindex="-1"
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
		onclick={(e) => {
			if (e.target === e.currentTarget && !importing) {
				showImportDialog = false;
			}
		}}
		onkeydown={(e) => {
			if (e.key === 'Escape' && !importing) {
				showImportDialog = false;
			}
		}}
	>
		<div class="w-full max-w-md rounded-lg border border-border bg-card shadow-lg">
			<div class="flex items-center justify-between border-b border-border p-6">
				<h2 id="import-dialog-title" class="text-2xl font-bold">
					{$t('vault.importDialog.title')}
				</h2>
				<button
					onclick={() => (showImportDialog = false)}
					class="text-muted-foreground transition-colors hover:text-foreground"
					disabled={importing}
					aria-label={$t('common.close')}
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="24"
						height="24"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
						class="h-5 w-5"
					>
						<path d="M18 6 6 18" />
						<path d="m6 6 12 12" />
					</svg>
				</button>
			</div>

			<div class="space-y-4 p-6">
				{#if importError}
					<div class="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
						<p>{importError}</p>
					</div>
				{/if}

				<div class="space-y-2">
					<label for="import-file" class="text-sm font-medium"
						>{$t('vault.importDialog.vaultFile')}</label
					>
					<input
						id="import-file"
						type="file"
						accept=".gullvault,.json"
						onchange={handleFileSelect}
						disabled={importing}
						class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
					/>
					{#if importFile}
						<p class="text-xs text-muted-foreground">{$t('common.selected')}: {importFile.name}</p>
					{/if}
				</div>

				<div class="space-y-2">
					<label for="import-password" class="text-sm font-medium">{$t('password.label')}</label>
					<div class="relative">
						<input
							id="import-password"
							type={showImportPassword ? 'text' : 'password'}
							bind:value={importPassword}
							placeholder={$t('password.placeholder')}
							disabled={importing}
							class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 pr-10 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
						/>
						<button
							type="button"
							onclick={() => (showImportPassword = !showImportPassword)}
							class="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
							tabindex="-1"
						>
							{#if showImportPassword}
								<EyeOffIcon class="h-4 w-4" />
							{:else}
								<EyeIcon class="h-4 w-4" />
							{/if}
						</button>
					</div>
				</div>

				<div class="space-y-2">
					<label for="import-name" class="text-sm font-medium"
						>{$t('vault.importDialog.vaultNameLabel')}
						<span class="text-muted-foreground">{$t('vault.importDialog.vaultNameOptional')}</span
						></label
					>
					<Input
						id="import-name"
						type="text"
						bind:value={importVaultName}
						placeholder={$t('vault.importDialog.vaultNamePlaceholder')}
						disabled={importing}
					/>
				</div>
			</div>

			<div class="flex gap-3 border-t border-border p-6">
				<Button
					onclick={() => (showImportDialog = false)}
					variant="outline"
					class="flex-1"
					disabled={importing}
				>
					{$t('common.cancel')}
				</Button>
				<Button
					onclick={handleImport}
					class="flex-1"
					disabled={!importFile || !importPassword || importing}
				>
					{#if importing}
						<div class="mr-2 h-4 w-4 animate-spin rounded-full border-b-2 border-current"></div>
						{$t('vault.importDialog.importing')}
					{:else}
						{$t('common.import')}
					{/if}
				</Button>
			</div>
		</div>
	</div>
{/if}
