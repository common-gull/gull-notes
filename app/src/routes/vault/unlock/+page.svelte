<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { selectedVaultForUnlock, clearVaultSelection, unlockVault } from '$lib/stores/vault';
	import { setupDatabaseHooks } from '$lib/stores/notes';
	import LockKeyholeIcon from '@lucide/svelte/icons/lock-keyhole';
	import EyeIcon from '@lucide/svelte/icons/eye';
	import EyeOffIcon from '@lucide/svelte/icons/eye-off';
	import Button from '$lib/components/ui/button/button.svelte';
	import { t } from '$lib/i18n';

	let password = $state('');
	let showPassword = $state(false);
	let unlocking = $state(false);
	let error = $state<string | null>(null);
	let passwordInput: HTMLInputElement | null = $state(null);
	let shouldRedirect = $state(false);

	// Check if vault is selected on mount
	onMount(() => {
		if (!$selectedVaultForUnlock) {
			shouldRedirect = true;
			goto(resolve('/vault/select'));
		}
	});

	$effect(() => {
		// Auto-focus password input when component mounts
		if (passwordInput && $selectedVaultForUnlock) {
			passwordInput.focus();
		}
	});

	async function handleUnlock() {
		const vault = $selectedVaultForUnlock;
		if (!password || !vault) {
			error = $t('password.enterPassword');
			return;
		}

		unlocking = true;
		error = null;

		try {
			const db = await unlockVault(vault.id, password);

			// Set up database hooks (activeDatabase is set automatically via store subscription)
			setupDatabaseHooks(db);

			// Navigate to vault
			await goto(resolve('/vault'));
		} catch (err) {
			console.error('Failed to unlock vault:', err);
			error = err instanceof Error ? err.message : $t('vault.failedToUnlock');
			password = ''; // Clear password on error
			passwordInput?.focus();
		} finally {
			unlocking = false;
		}
	}

	async function handleCancel() {
		clearVaultSelection();
		await goto(resolve('/vault/select'));
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !unlocking) {
			handleUnlock();
		}
	}

	function togglePasswordVisibility() {
		showPassword = !showPassword;
	}
</script>

{#if $selectedVaultForUnlock && !shouldRedirect}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-background p-4">
		<div class="w-full max-w-md">
			<div class="mb-8 text-center">
				<div
					class="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-primary/10"
				>
					<LockKeyholeIcon class="h-8 w-8 text-primary" />
				</div>
				<h1 class="mb-2 text-3xl font-bold">{$t('vault.unlockTitle')}</h1>
				<p class="text-muted-foreground">
					{$t('vault.unlockDescription', { name: $selectedVaultForUnlock.name })}
				</p>
			</div>

			<div class="space-y-4">
				{#if error}
					<div class="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
						{error}
					</div>
				{/if}

				<div class="space-y-2">
					<label for="password" class="text-sm font-medium">{$t('password.label')}</label>
					<div class="relative">
						<input
							id="password"
							bind:this={passwordInput}
							type={showPassword ? 'text' : 'password'}
							bind:value={password}
							onkeydown={handleKeydown}
							placeholder={$t('password.placeholder')}
							disabled={unlocking}
							class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 pr-10 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
						/>
						<button
							type="button"
							onclick={togglePasswordVisibility}
							class="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
							tabindex="-1"
						>
							{#if showPassword}
								<EyeOffIcon class="h-4 w-4" />
							{:else}
								<EyeIcon class="h-4 w-4" />
							{/if}
						</button>
					</div>
				</div>

				<div class="flex gap-3">
					<Button onclick={handleCancel} variant="outline" class="flex-1" disabled={unlocking}>
						{$t('common.cancel')}
					</Button>
					<Button onclick={handleUnlock} class="flex-1" disabled={unlocking || !password}>
						{#if unlocking}
							<span
								class="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-b-2 border-background"
							></span>
							{$t('vault.unlocking')}
						{:else}
							{$t('vault.unlock')}
						{/if}
					</Button>
				</div>
			</div>
		</div>
	</div>
{/if}
