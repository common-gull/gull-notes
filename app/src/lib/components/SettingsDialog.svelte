<script lang="ts">
	import { onDestroy } from 'svelte';
	import { changeVaultPassword, exportVault } from '$lib/services/vaults';
	import { downloadBlob, generateExportFilename } from '$lib/utils/file';
	import Button from './ui/button/button.svelte';
	import XIcon from '@lucide/svelte/icons/x';
	import CheckIcon from '@lucide/svelte/icons/check';
	import EyeIcon from '@lucide/svelte/icons/eye';
	import EyeOffIcon from '@lucide/svelte/icons/eye-off';
	import Download from '@lucide/svelte/icons/download';

	interface Props {
		vaultId: string;
		vaultName: string;
		onClose: () => void;
		onPasswordChanged: (newVaultId: string) => void;
	}

	let { vaultId, vaultName, onClose, onPasswordChanged }: Props = $props();

	let currentPassword = $state('');
	let newPassword = $state('');
	let confirmPassword = $state('');
	let showCurrentPassword = $state(false);
	let showNewPassword = $state(false);
	let showConfirmPassword = $state(false);

	let changing = $state(false);
	let error = $state<string | null>(null);
	let stage = $state<string>('');
	let progress = $state({ current: 0, total: 0 });
	let success = $state(false);
	let countdown = $state(3);
	let countdownTimer: ReturnType<typeof setInterval> | null = null;

	// Export state
	let exporting = $state(false);
	let exportPassword = $state('');
	let showExportPassword = $state(false);
	let exportError = $state<string | null>(null);

	// Password strength calculation
	let passwordStrength = $derived.by(() => {
		if (!newPassword) return { score: 0, label: '', color: '' };

		let score = 0;
		if (newPassword.length >= 8) score++;
		if (newPassword.length >= 12) score++;
		if (/[a-z]/.test(newPassword) && /[A-Z]/.test(newPassword)) score++;
		if (/\d/.test(newPassword)) score++;
		if (/[^a-zA-Z0-9]/.test(newPassword)) score++;

		if (score <= 1) return { score, label: 'Weak', color: 'text-destructive' };
		if (score <= 3) return { score, label: 'Fair', color: 'text-yellow-500' };
		if (score <= 4) return { score, label: 'Good', color: 'text-blue-500' };
		return { score, label: 'Strong', color: 'text-green-500' };
	});

	let isValid = $derived(
		currentPassword.length > 0 &&
			newPassword.length >= 8 &&
			newPassword === confirmPassword &&
			!changing
	);

	async function handleChangePassword() {
		if (!isValid) return;

		changing = true;
		error = null;
		success = false;

		try {
			stage = 'Verifying current password...';
			await new Promise((resolve) => setTimeout(resolve, 100)); // Allow UI to update

			const newVaultId = await changeVaultPassword(
				vaultId,
				currentPassword,
				newPassword,
				(current, total) => {
					stage = 'Re-encrypting notes...';
					progress = { current, total };
				}
			);

			stage = 'Password changed successfully!';
			success = true;
			countdown = 3;

			// Countdown timer
			countdownTimer = setInterval(() => {
				countdown--;
				if (countdown <= 0) {
					if (countdownTimer) {
						clearInterval(countdownTimer);
						countdownTimer = null;
					}
					onPasswordChanged(newVaultId);
				}
			}, 1000);
		} catch (err) {
			console.error('Failed to change password:', err);
			const errorMessage = err instanceof Error ? err.message : 'Failed to change password';

			// Provide clear guidance based on error type
			if (errorMessage.includes('Note count mismatch') || errorMessage.includes('Missing')) {
				error = `Data verification failed: ${errorMessage}\n\nYour original vault has been preserved and no changes were made.`;
			} else if (errorMessage.includes('Current password is incorrect')) {
				error = errorMessage;
			} else if (errorMessage.includes('Failed to decrypt')) {
				error = `Encryption verification failed: ${errorMessage}\n\nYour original vault has been preserved.`;
			} else {
				error = `${errorMessage}\n\nYour original vault has been preserved and no changes were made.`;
			}

			changing = false;
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && isValid && !changing) {
			handleChangePassword();
		} else if (e.key === 'Escape' && !changing) {
			onClose();
		}
	}

	async function handleExportVault() {
		if (!exportPassword) return;

		exporting = true;
		exportError = null;

		try {
			const blob = await exportVault(vaultId, exportPassword);
			const filename = generateExportFilename(vaultName);
			downloadBlob(blob, filename);

			// Clear password and show success
			exportPassword = '';
			exportError = null;
		} catch (err) {
			console.error('Failed to export vault:', err);
			const errorMessage = err instanceof Error ? err.message : 'Failed to export vault';

			if (errorMessage.includes('Invalid password')) {
				exportError = 'Incorrect password';
			} else {
				exportError = errorMessage;
			}
		} finally {
			exporting = false;
		}
	}

	onDestroy(() => {
		// Clean up countdown timer if component unmounts
		if (countdownTimer) {
			clearInterval(countdownTimer);
			countdownTimer = null;
		}
	});
</script>

<div class="fixed inset-0 z-50 flex items-center justify-center bg-background p-4">
	<div class="w-full max-w-md rounded-lg border border-border bg-card shadow-lg">
		<div class="flex items-center justify-between border-b border-border p-6">
			<h2 class="text-2xl font-bold">Settings</h2>
			<button
				onclick={onClose}
				class="text-muted-foreground transition-colors hover:text-foreground"
				disabled={changing}
			>
				<XIcon class="h-5 w-5" />
			</button>
		</div>

		<div class="space-y-6 p-6">
			<div class="rounded-lg bg-muted/50 p-3 text-sm">
				<p class="mb-1 font-medium">Current Vault: {vaultName}</p>
			</div>

			<!-- Export Vault Section -->
			<div class="space-y-4">
				<h3 class="text-lg font-semibold">Export Vault</h3>
				<p class="text-sm text-muted-foreground">
					Download a backup of your vault. All data remains encrypted.
				</p>

				{#if exportError}
					<div class="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
						<p>{exportError}</p>
					</div>
				{/if}

				<div class="space-y-2">
					<label for="export-password" class="text-sm font-medium">Confirm Password</label>
					<div class="relative">
						<input
							id="export-password"
							type={showExportPassword ? 'text' : 'password'}
							bind:value={exportPassword}
							placeholder="Enter password to export"
							disabled={exporting}
							class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 pr-10 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
						/>
						<button
							type="button"
							onclick={() => (showExportPassword = !showExportPassword)}
							class="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
							tabindex="-1"
						>
							{#if showExportPassword}
								<EyeOffIcon class="h-4 w-4" />
							{:else}
								<EyeIcon class="h-4 w-4" />
							{/if}
						</button>
					</div>
				</div>

				<Button
					onclick={handleExportVault}
					disabled={!exportPassword || exporting}
					variant="outline"
					class="w-full"
				>
					{#if exporting}
						<div class="mr-2 h-4 w-4 animate-spin rounded-full border-b-2 border-current"></div>
						Exporting...
					{:else}
						<Download class="mr-2 h-4 w-4" />
						Export Vault
					{/if}
				</Button>
			</div>

			<div class="border-t border-border"></div>

			{#if error}
				<div class="space-y-2 rounded-lg bg-destructive/10 p-4 text-sm text-destructive">
					<p class="font-semibold">Error</p>
					<p class="whitespace-pre-line">{error}</p>
				</div>
			{/if}

			{#if success}
				<div class="rounded-lg bg-green-500/10 p-4 text-center text-green-500">
					<CheckIcon class="mx-auto mb-2 h-8 w-8" />
					<p class="mb-1 font-semibold">{stage}</p>
					<p class="text-sm">Redirecting in {countdown}...</p>
				</div>
			{:else if changing}
				<div class="space-y-3">
					<div class="text-center">
						<div
							class="mb-2 inline-block h-8 w-8 animate-spin rounded-full border-b-2 border-primary"
						></div>
						<p class="text-sm font-medium">{stage}</p>
						{#if progress.total > 0}
							<p class="mt-1 text-xs text-muted-foreground">
								{progress.current} / {progress.total} notes ({Math.round(
									(progress.current / progress.total) * 100
								)}%)
							</p>
							<div class="mt-2 h-2 w-full rounded-full bg-muted">
								<div
									class="h-2 rounded-full bg-primary transition-all duration-300"
									style="width: {(progress.current / progress.total) * 100}%"
								></div>
							</div>
						{/if}
					</div>
					<p class="text-center text-xs text-muted-foreground">
						Please do not close this window...
					</p>
				</div>
			{:else}
				<div class="space-y-4">
					<h3 class="text-lg font-semibold">Change Password</h3>

					<div class="space-y-2">
						<label for="current-password" class="text-sm font-medium">Current Password</label>
						<div class="relative">
							<input
								id="current-password"
								type={showCurrentPassword ? 'text' : 'password'}
								bind:value={currentPassword}
								onkeydown={handleKeydown}
								placeholder="Enter current password"
								disabled={changing}
								class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 pr-10 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
							/>
							<button
								type="button"
								onclick={() => (showCurrentPassword = !showCurrentPassword)}
								class="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
								tabindex="-1"
							>
								{#if showCurrentPassword}
									<EyeOffIcon class="h-4 w-4" />
								{:else}
									<EyeIcon class="h-4 w-4" />
								{/if}
							</button>
						</div>
					</div>

					<div class="space-y-2">
						<label for="new-password" class="text-sm font-medium">New Password</label>
						<div class="relative">
							<input
								id="new-password"
								type={showNewPassword ? 'text' : 'password'}
								bind:value={newPassword}
								onkeydown={handleKeydown}
								placeholder="Enter new password"
								disabled={changing}
								class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 pr-10 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
							/>
							<button
								type="button"
								onclick={() => (showNewPassword = !showNewPassword)}
								class="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
								tabindex="-1"
							>
								{#if showNewPassword}
									<EyeOffIcon class="h-4 w-4" />
								{:else}
									<EyeIcon class="h-4 w-4" />
								{/if}
							</button>
						</div>
						{#if newPassword}
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
						<label for="confirm-password" class="text-sm font-medium">Confirm New Password</label>
						<div class="relative">
							<input
								id="confirm-password"
								type={showConfirmPassword ? 'text' : 'password'}
								bind:value={confirmPassword}
								onkeydown={handleKeydown}
								placeholder="Re-enter new password"
								disabled={changing}
								class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 pr-10 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
							/>
							<button
								type="button"
								onclick={() => (showConfirmPassword = !showConfirmPassword)}
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
						{#if confirmPassword && newPassword !== confirmPassword}
							<p class="flex items-center gap-1 text-sm text-destructive">
								<XIcon class="h-3 w-3" />
								Passwords do not match
							</p>
						{:else if confirmPassword && newPassword === confirmPassword}
							<p class="flex items-center gap-1 text-sm text-green-500">
								<CheckIcon class="h-3 w-3" />
								Passwords match
							</p>
						{/if}
					</div>

					<div class="rounded-lg bg-yellow-500/10 p-3 text-sm text-yellow-700 dark:text-yellow-500">
						<p class="mb-1 font-medium">⚠️ Important:</p>
						<ul class="list-inside list-disc space-y-0.5 text-xs">
							<li>All notes will be re-encrypted with new keys</li>
							<li>This process cannot be cancelled once started</li>
							<li>You'll be logged out after completion</li>
						</ul>
					</div>
				</div>
			{/if}
		</div>

		{#if !success && !changing}
			<div class="flex gap-3 border-t border-border p-6">
				<Button onclick={onClose} variant="outline" class="flex-1">Cancel</Button>
				<Button onclick={handleChangePassword} class="flex-1" disabled={!isValid}>
					Change Password
				</Button>
			</div>
		{/if}
	</div>
</div>
