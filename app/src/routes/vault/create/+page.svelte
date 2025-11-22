<script lang="ts">
	import { goto } from '$app/navigation';
	import { createVault } from '$lib/services/vaults';
	import { activateVault } from '$lib/stores/vault';
	import { setupDatabaseHooks } from '$lib/stores/notes';
	import { openDatabase } from '$lib/db';
	import type { NotesDatabase } from '$lib/db';
	import Button from '$lib/components/ui/button/button.svelte';
	import { DatabaseIcon, CheckIcon, XIcon, EyeIcon, EyeOffIcon } from 'lucide-svelte';

	let vaultName = $state('');
	let password = $state('');
	let confirmPassword = $state('');
	let showPassword = $state(false);
	let showConfirmPassword = $state(false);
	let creating = $state(false);
	let error = $state<string | null>(null);
	let vaultNameInput: HTMLInputElement | null = $state(null);

	$effect(() => {
		// Auto-focus vault name input when component mounts
		if (vaultNameInput) {
			vaultNameInput.focus();
		}
	});

	// Password strength calculation
	let passwordStrength = $derived.by(() => {
		if (!password) return { score: 0, label: '', color: '' };

		let score = 0;
		if (password.length >= 8) score++;
		if (password.length >= 12) score++;
		if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
		if (/\d/.test(password)) score++;
		if (/[^a-zA-Z0-9]/.test(password)) score++;

		if (score <= 1) return { score, label: 'Weak', color: 'text-destructive' };
		if (score <= 3) return { score, label: 'Fair', color: 'text-yellow-500' };
		if (score <= 4) return { score, label: 'Good', color: 'text-blue-500' };
		return { score, label: 'Strong', color: 'text-green-500' };
	});

	let isValid = $derived(
		vaultName.trim().length > 0 && password.length >= 8 && password === confirmPassword
	);

	async function handleCreate() {
		if (!isValid) return;

		creating = true;
		error = null;

		try {
			const vaultId = await createVault(vaultName.trim(), password);
			const db = openDatabase(vaultId);

			// Get vault metadata
			const { getVaultMetadata } = await import('$lib/services/vaults');
			const metadata = await getVaultMetadata(vaultId);

			if (!metadata) {
				throw new Error('Failed to get vault metadata');
			}

			// Activate vault in store
			activateVault(vaultId, metadata.name, metadata.createdAt, db);

			// Set up database hooks
			setupDatabaseHooks(db);

			// Navigate to vault
			await goto('/vault');
		} catch (err) {
			console.error('Failed to create vault:', err);
			error = err instanceof Error ? err.message : 'Failed to create vault';
			creating = false;
		}
	}

	async function handleCancel() {
		await goto('/');
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && isValid && !creating) {
			handleCreate();
		}
	}

	function togglePasswordVisibility() {
		showPassword = !showPassword;
	}

	function toggleConfirmPasswordVisibility() {
		showConfirmPassword = !showConfirmPassword;
	}
</script>

<div class="fixed inset-0 z-50 flex items-center justify-center bg-background p-4">
	<div class="w-full max-w-xl">
		<div class="mb-8 text-center">
			<div
				class="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-primary/10"
			>
				<DatabaseIcon class="h-8 w-8 text-primary" />
			</div>
			<h1 class="mb-2 text-3xl font-bold">Create New Vault</h1>
			<p class="text-muted-foreground">Set up a secure encrypted vault for your notes</p>
		</div>

		<div class="space-y-6">
			{#if error}
				<div class="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
					{error}
				</div>
			{/if}

			<div class="space-y-2">
				<label for="vault-name" class="text-sm font-medium">Vault Name</label>
				<input
					id="vault-name"
					bind:this={vaultNameInput}
					bind:value={vaultName}
					onkeydown={handleKeydown}
					placeholder="My Personal Notes"
					disabled={creating}
					class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
				/>
				<p class="text-xs text-muted-foreground">Display name for your vault (not encrypted)</p>
			</div>

			<div class="space-y-2">
				<label for="password" class="text-sm font-medium">Password</label>
				<div class="relative">
					<input
						id="password"
						type={showPassword ? 'text' : 'password'}
						bind:value={password}
						onkeydown={handleKeydown}
						placeholder="Enter a strong password"
						disabled={creating}
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
				{#if password}
					<div class="flex items-center gap-2 text-sm">
						<div class="h-2 flex-1 overflow-hidden rounded-full bg-muted">
							<div
								class="h-full bg-primary transition-all duration-300"
								style="width: {(passwordStrength.score / 5) * 100}%"
							></div>
						</div>
						<span class={passwordStrength.color}>{passwordStrength.label}</span>
					</div>
				{/if}
			</div>

			<div class="space-y-2">
				<label for="confirm-password" class="text-sm font-medium">Confirm Password</label>
				<div class="relative">
					<input
						id="confirm-password"
						type={showConfirmPassword ? 'text' : 'password'}
						bind:value={confirmPassword}
						onkeydown={handleKeydown}
						placeholder="Re-enter your password"
						disabled={creating}
						class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 pr-10 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
					/>
					<button
						type="button"
						onclick={toggleConfirmPasswordVisibility}
						class="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
						tabindex="-1"
					>
						{#if showConfirmPassword}
							<EyeOffIcon class="h-4 w-4" />
						{:else}
							<EyeIcon class="h-4 w-4" />
						{/if}
					</button>
				</div>
				{#if confirmPassword && password !== confirmPassword}
					<p class="flex items-center gap-1 text-sm text-destructive">
						<XIcon class="h-3 w-3" />
						Passwords do not match
					</p>
				{:else if confirmPassword && password === confirmPassword}
					<p class="flex items-center gap-1 text-sm text-green-500">
						<CheckIcon class="h-3 w-3" />
						Passwords match
					</p>
				{/if}
			</div>

			<div class="rounded-lg bg-muted/50 p-4 text-sm">
				<p class="mb-2 font-medium">Password requirements:</p>
				<ul class="space-y-1.5">
					<li
						class="flex items-center gap-2 {password.length >= 8
							? 'text-green-500'
							: 'text-muted-foreground'}"
					>
						{#if password.length >= 8}
							<CheckIcon class="h-4 w-4" />
						{:else}
							<span class="flex h-4 w-4 items-center justify-center text-xs">•</span>
						{/if}
						At least 8 characters
					</li>
					<li class="flex items-center gap-2 text-muted-foreground">
						<span class="flex h-4 w-4 items-center justify-center text-xs">•</span>
						Mix of uppercase and lowercase letters
					</li>
					<li class="flex items-center gap-2 text-muted-foreground">
						<span class="flex h-4 w-4 items-center justify-center text-xs">•</span>
						Include numbers and special characters
					</li>
				</ul>
			</div>

			<div class="flex gap-3 pt-2">
				<Button onclick={handleCancel} variant="outline" class="flex-1" disabled={creating}>
					Cancel
				</Button>
				<Button onclick={handleCreate} class="flex-1" disabled={!isValid || creating}>
					{#if creating}
						<span
							class="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-b-2 border-background"
						></span>
						Creating...
					{:else}
						Create Vault
					{/if}
				</Button>
			</div>
		</div>
	</div>
</div>
