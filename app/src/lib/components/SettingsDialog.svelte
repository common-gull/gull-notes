<script lang="ts">
	import { onDestroy } from 'svelte';
	import { changeVaultPassword } from '$lib/services/vaults';
	import Button from './ui/button/button.svelte';
	import { XIcon, CheckIcon, EyeIcon, EyeOffIcon } from 'lucide-svelte';

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
			await new Promise(resolve => setTimeout(resolve, 100)); // Allow UI to update

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

	onDestroy(() => {
		// Clean up countdown timer if component unmounts
		if (countdownTimer) {
			clearInterval(countdownTimer);
			countdownTimer = null;
		}
	});
</script>

<div class="fixed inset-0 z-50 bg-background flex items-center justify-center p-4">
	<div class="w-full max-w-md bg-card border border-border rounded-lg shadow-lg">
		<div class="flex items-center justify-between p-6 border-b border-border">
			<h2 class="text-2xl font-bold">Settings</h2>
			<button
				onclick={onClose}
				class="text-muted-foreground hover:text-foreground transition-colors"
				disabled={changing}
			>
				<XIcon class="w-5 h-5" />
			</button>
		</div>

		<div class="p-6 space-y-6">
			<div class="bg-muted/50 rounded-lg p-3 text-sm">
				<p class="font-medium mb-1">Current Vault: {vaultName}</p>
			</div>

			{#if error}
				<div class="bg-destructive/10 text-destructive rounded-lg p-4 text-sm space-y-2">
					<p class="font-semibold">Error</p>
					<p class="whitespace-pre-line">{error}</p>
				</div>
			{/if}

			{#if success}
				<div class="bg-green-500/10 text-green-500 rounded-lg p-4 text-center">
					<CheckIcon class="w-8 h-8 mx-auto mb-2" />
					<p class="font-semibold mb-1">{stage}</p>
					<p class="text-sm">Redirecting in {countdown}...</p>
				</div>
			{:else if changing}
				<div class="space-y-3">
					<div class="text-center">
						<div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-2"></div>
						<p class="text-sm font-medium">{stage}</p>
						{#if progress.total > 0}
							<p class="text-xs text-muted-foreground mt-1">
								{progress.current} / {progress.total} notes ({Math.round((progress.current / progress.total) * 100)}%)
							</p>
							<div class="w-full bg-muted rounded-full h-2 mt-2">
								<div
									class="bg-primary h-2 rounded-full transition-all duration-300"
									style="width: {(progress.current / progress.total) * 100}%"
								></div>
							</div>
						{/if}
					</div>
					<p class="text-xs text-muted-foreground text-center">
						Please do not close this window...
					</p>
				</div>
			{:else}
				<div class="space-y-4">
					<h3 class="font-semibold text-lg">Change Password</h3>

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
								class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm pr-10"
							/>
							<button
								type="button"
								onclick={() => showCurrentPassword = !showCurrentPassword}
								class="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
								tabindex="-1"
							>
								{#if showCurrentPassword}
									<EyeOffIcon class="w-4 h-4" />
								{:else}
									<EyeIcon class="w-4 h-4" />
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
								class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm pr-10"
							/>
							<button
								type="button"
								onclick={() => showNewPassword = !showNewPassword}
								class="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
								tabindex="-1"
							>
								{#if showNewPassword}
									<EyeOffIcon class="w-4 h-4" />
								{:else}
									<EyeIcon class="w-4 h-4" />
								{/if}
							</button>
						</div>
						{#if newPassword}
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
						<label for="confirm-password" class="text-sm font-medium">Confirm New Password</label>
						<div class="relative">
							<input
								id="confirm-password"
								type={showConfirmPassword ? 'text' : 'password'}
								bind:value={confirmPassword}
								onkeydown={handleKeydown}
								placeholder="Re-enter new password"
								disabled={changing}
								class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm pr-10"
							/>
							<button
								type="button"
								onclick={() => showConfirmPassword = !showConfirmPassword}
								class="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
								tabindex="-1"
							>
								{#if showConfirmPassword}
									<EyeOffIcon class="w-4 h-4" />
								{:else}
									<EyeIcon class="w-4 h-4" />
								{/if}
							</button>
						</div>
						{#if confirmPassword && newPassword !== confirmPassword}
							<p class="text-sm text-destructive flex items-center gap-1">
								<XIcon class="w-3 h-3" />
								Passwords do not match
							</p>
						{:else if confirmPassword && newPassword === confirmPassword}
							<p class="text-sm text-green-500 flex items-center gap-1">
								<CheckIcon class="w-3 h-3" />
								Passwords match
							</p>
						{/if}
					</div>

					<div class="bg-yellow-500/10 text-yellow-700 dark:text-yellow-500 rounded-lg p-3 text-sm">
						<p class="font-medium mb-1">⚠️ Important:</p>
						<ul class="list-disc list-inside space-y-0.5 text-xs">
							<li>All notes will be re-encrypted with new keys</li>
							<li>This process cannot be cancelled once started</li>
							<li>You'll be logged out after completion</li>
						</ul>
					</div>
				</div>
			{/if}
		</div>

		{#if !success && !changing}
			<div class="flex gap-3 p-6 border-t border-border">
				<Button
					onclick={onClose}
					variant="outline"
					class="flex-1"
				>
					Cancel
				</Button>
				<Button
					onclick={handleChangePassword}
					class="flex-1"
					disabled={!isValid}
				>
					Change Password
				</Button>
			</div>
		{/if}
	</div>
</div>

