<script lang="ts">
	import { createVault } from '$lib/services/vaults';
	import Button from './ui/button/button.svelte';
	import Input from './ui/input/input.svelte';
	import { XIcon, CheckIcon, AlertCircleIcon } from 'lucide-svelte';
	import type { NotesDatabase } from '$lib/db';
	import { openDatabase } from '$lib/db';

	interface Props {
		onCreated: (vaultId: string, db: NotesDatabase) => void;
		onCancel: () => void;
	}

	let { onCreated, onCancel }: Props = $props();

	let vaultName = $state('');
	let password = $state('');
	let confirmPassword = $state('');
	let creating = $state(false);
	let error = $state<string | null>(null);

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
		vaultName.trim().length > 0 &&
		password.length >= 8 &&
		password === confirmPassword
	);

	async function handleCreate() {
		if (!isValid) return;

		creating = true;
		error = null;

		try {
			const vaultId = await createVault(vaultName.trim(), password);
			const db = openDatabase(vaultId);
			onCreated(vaultId, db);
		} catch (err) {
			console.error('Failed to create vault:', err);
			error = err instanceof Error ? err.message : 'Failed to create vault';
		} finally {
			creating = false;
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && isValid && !creating) {
			handleCreate();
		} else if (e.key === 'Escape') {
			onCancel();
		}
	}
</script>

<div class="fixed inset-0 z-50 bg-background flex items-center justify-center p-4">
	<div class="w-full max-w-md bg-card border border-border rounded-lg shadow-lg">
		<div class="flex items-center justify-between p-6 border-b border-border">
			<h2 class="text-2xl font-bold">Create New Vault</h2>
			<button
				onclick={onCancel}
				class="text-muted-foreground hover:text-foreground transition-colors"
				disabled={creating}
			>
				<XIcon class="w-5 h-5" />
			</button>
		</div>

		<div class="p-6 space-y-4">
			{#if error}
				<div class="bg-destructive/10 text-destructive rounded-lg p-3 text-sm flex items-start gap-2">
					<AlertCircleIcon class="w-4 h-4 flex-shrink-0 mt-0.5" />
					<span>{error}</span>
				</div>
			{/if}

			<div class="space-y-2">
				<label for="vault-name" class="text-sm font-medium">Vault Name</label>
				<Input
					id="vault-name"
					bind:value={vaultName}
					onkeydown={handleKeydown}
					placeholder="My Personal Notes"
					disabled={creating}
				/>
				<p class="text-xs text-muted-foreground">
					This is a display name only and will not be encrypted. All note contents remain encrypted.
				</p>
			</div>

			<div class="space-y-2">
				<label for="password" class="text-sm font-medium">Password</label>
				<Input
					id="password"
					type="password"
					bind:value={password}
					onkeydown={handleKeydown}
					placeholder="Enter a strong password"
					disabled={creating}
				/>
				{#if password}
					<div class="flex items-center gap-2 text-sm">
						<div class="flex-1 bg-muted rounded-full h-2 overflow-hidden">
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
				<Input
					id="confirm-password"
					type="password"
					bind:value={confirmPassword}
					onkeydown={handleKeydown}
					placeholder="Re-enter your password"
					disabled={creating}
				/>
				{#if confirmPassword && password !== confirmPassword}
					<p class="text-sm text-destructive flex items-center gap-1">
						<XIcon class="w-3 h-3" />
						Passwords do not match
					</p>
				{:else if confirmPassword && password === confirmPassword}
					<p class="text-sm text-green-500 flex items-center gap-1">
						<CheckIcon class="w-3 h-3" />
						Passwords match
					</p>
				{/if}
			</div>

			<div class="bg-muted/50 rounded-lg p-3 text-sm text-muted-foreground">
				<p class="mb-1">Password requirements:</p>
				<ul class="list-disc list-inside space-y-0.5">
					<li class={password.length >= 8 ? 'text-green-500' : ''}>At least 8 characters</li>
					<li>Mix of uppercase and lowercase letters</li>
					<li>Include numbers and special characters</li>
				</ul>
			</div>
		</div>

		<div class="flex gap-3 p-6 border-t border-border">
			<Button
				onclick={onCancel}
				variant="outline"
				class="flex-1"
				disabled={creating}
			>
				Cancel
			</Button>
			<Button
				onclick={handleCreate}
				class="flex-1"
				disabled={!isValid || creating}
			>
				{#if creating}
					<span class="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-background mr-2"></span>
					Creating...
				{:else}
					Create Vault
				{/if}
			</Button>
		</div>
	</div>
</div>

