<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import { activeVault, lockVault } from '$lib/stores/vault';
	import { getActiveDatabase } from '$lib/stores/notes';
	import { changeVaultPassword, deleteVault } from '$lib/services/vaults';
	import { encryptData, sessionKeyManager } from '$lib/services/encryption';
	import Button from '$lib/components/ui/button/button.svelte';
	import { 
		ArrowLeftIcon, 
		CheckIcon, 
		EyeIcon, 
		EyeOffIcon, 
		XIcon,
		InfoIcon,
		ShieldIcon,
		TrashIcon
	} from 'lucide-svelte';

	let noteCount = $state(0);
	let showPasswordForm = $state(false);
	let showDeleteConfirm = $state(false);
	let deleteConfirmText = $state('');
	let deleting = $state(false);

	// Password change state
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

	let isPasswordFormValid = $derived(
		currentPassword.length > 0 &&
		newPassword.length >= 8 &&
		newPassword === confirmPassword &&
		!changing
	);

	let isDeleteConfirmValid = $derived(
		deleteConfirmText === $activeVault?.name && !deleting
	);

	function formatDate(timestamp: number): string {
		return new Date(timestamp).toLocaleDateString(undefined, {
			year: 'numeric',
			month: 'long',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	async function loadVaultInfo() {
		const db = getActiveDatabase();
		if (db) {
			const count = await db.notes.count();
			noteCount = count;
		}
	}

	async function handleChangePassword() {
		if (!isPasswordFormValid || !$activeVault) return;

		changing = true;
		error = null;
		success = false;

		try {
			stage = 'Verifying current password...';
			await new Promise(resolve => setTimeout(resolve, 100)); // Allow UI to update

			const newVaultId = await changeVaultPassword(
				$activeVault.id,
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
					// Lock vault and redirect to unlock
					lockVault();
					goto('/');
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

	async function handleDeleteVault() {
		if (!isDeleteConfirmValid || !$activeVault) return;

		deleting = true;
		error = null;

		try {
			await deleteVault($activeVault.id);
			
			// Lock vault and redirect to home
			lockVault();
			await goto('/');
		} catch (err) {
			console.error('Failed to delete vault:', err);
			error = err instanceof Error ? err.message : 'Failed to delete vault';
			deleting = false;
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && showPasswordForm && isPasswordFormValid && !changing) {
			handleChangePassword();
		} else if (e.key === 'Escape') {
			if (showPasswordForm && !changing) {
				showPasswordForm = false;
				// Reset form
				currentPassword = '';
				newPassword = '';
				confirmPassword = '';
				error = null;
			} else if (showDeleteConfirm && !deleting) {
				showDeleteConfirm = false;
				deleteConfirmText = '';
			}
		}
	}

	onMount(() => {
		if (!$activeVault) {
			goto('/');
			return;
		}
		loadVaultInfo();
	});

	onDestroy(() => {
		// Clean up countdown timer if component unmounts
		if (countdownTimer) {
			clearInterval(countdownTimer);
			countdownTimer = null;
		}
	});
</script>

<div class="h-full flex flex-col bg-background">
	<!-- Header -->
	<header class="border-b bg-background px-4 py-3 flex items-center gap-4">
		<Button variant="ghost" size="icon" onclick={() => goto('/vault')}>
			<ArrowLeftIcon class="h-5 w-5" />
		</Button>
		<h1 class="text-xl font-semibold">Settings</h1>
	</header>

	<!-- Content -->
	<div class="flex-1 overflow-auto">
		<div class="max-w-3xl mx-auto p-6 space-y-8">
			{#if $activeVault}
				<!-- Vault Information Section -->
				<section class="space-y-4">
					<div class="flex items-center gap-2">
						<InfoIcon class="w-5 h-5 text-primary" />
						<h2 class="text-2xl font-bold">Vault Information</h2>
					</div>
					
					<div class="bg-muted/50 rounded-lg p-6 space-y-3">
						<div class="flex justify-between items-start">
							<div>
								<p class="text-sm text-muted-foreground">Vault Name</p>
								<p class="text-lg font-semibold">{$activeVault.name}</p>
							</div>
						</div>
						
						<div class="border-t border-border pt-3">
							<p class="text-sm text-muted-foreground">Created</p>
							<p class="font-medium">{formatDate($activeVault.createdAt)}</p>
						</div>
						
						<div class="border-t border-border pt-3">
							<p class="text-sm text-muted-foreground">Notes</p>
							<p class="font-medium">{noteCount} {noteCount === 1 ? 'note' : 'notes'}</p>
						</div>
					</div>
				</section>

				<!-- Security Section -->
				<section class="space-y-4">
					<div class="flex items-center gap-2">
						<ShieldIcon class="w-5 h-5 text-primary" />
						<h2 class="text-2xl font-bold">Security</h2>
					</div>

					{#if !showPasswordForm}
						<div class="bg-muted/50 rounded-lg p-6">
							<div class="flex items-start justify-between">
								<div class="flex-1">
									<h3 class="font-semibold text-lg mb-1">Change Password</h3>
									<p class="text-sm text-muted-foreground">
										Update your vault password. All notes will be re-encrypted.
									</p>
								</div>
								<Button onclick={() => showPasswordForm = true}>
									Change Password
								</Button>
							</div>
						</div>
					{:else}
						<div class="bg-card border border-border rounded-lg p-6 space-y-4">
							<div class="flex items-center justify-between">
								<h3 class="font-semibold text-lg">Change Password</h3>
								{#if !changing && !success}
									<button
										onclick={() => {
											showPasswordForm = false;
											currentPassword = '';
											newPassword = '';
											confirmPassword = '';
											error = null;
										}}
										class="text-muted-foreground hover:text-foreground transition-colors"
									>
										<XIcon class="w-5 h-5" />
									</button>
								{/if}
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

									<div class="flex gap-3">
										<Button
											onclick={() => {
												showPasswordForm = false;
												currentPassword = '';
												newPassword = '';
												confirmPassword = '';
												error = null;
											}}
											variant="outline"
											class="flex-1"
										>
											Cancel
										</Button>
										<Button
											onclick={handleChangePassword}
											class="flex-1"
											disabled={!isPasswordFormValid}
										>
											Change Password
										</Button>
									</div>
								</div>
							{/if}
						</div>
					{/if}
				</section>

				<!-- Danger Zone Section -->
				<section class="space-y-4">
					<div class="flex items-center gap-2">
						<TrashIcon class="w-5 h-5 text-destructive" />
						<h2 class="text-2xl font-bold text-destructive">Danger Zone</h2>
					</div>

					<div class="bg-destructive/10 border border-destructive/20 rounded-lg p-6 space-y-4">
						<div>
							<h3 class="font-semibold text-lg mb-1">Delete Vault</h3>
							<p class="text-sm text-muted-foreground">
								Permanently delete this vault and all its notes. This action cannot be undone.
							</p>
						</div>

						{#if !showDeleteConfirm}
							<Button
								onclick={() => showDeleteConfirm = true}
								variant="destructive"
							>
								<TrashIcon class="w-4 h-4 mr-2" />
								Delete Vault
							</Button>
						{:else}
							<div class="space-y-4 pt-2">
								<div class="bg-destructive/20 rounded-lg p-4 space-y-2">
									<p class="font-semibold text-sm">⚠️ Warning: This action is permanent!</p>
									<ul class="list-disc list-inside space-y-1 text-xs">
										<li>All {noteCount} {noteCount === 1 ? 'note' : 'notes'} will be permanently deleted</li>
										<li>This vault cannot be recovered after deletion</li>
										<li>You will be logged out immediately</li>
									</ul>
								</div>

								<div class="space-y-2">
									<label for="delete-confirm" class="text-sm font-medium">
										Type <strong>{$activeVault.name}</strong> to confirm
									</label>
									<input
										id="delete-confirm"
										type="text"
										bind:value={deleteConfirmText}
										placeholder="Enter vault name"
										disabled={deleting}
										class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
									/>
								</div>

								{#if error}
									<div class="bg-destructive/10 text-destructive rounded-lg p-3 text-sm">
										{error}
									</div>
								{/if}

								<div class="flex gap-3">
									<Button
										onclick={() => {
											showDeleteConfirm = false;
											deleteConfirmText = '';
											error = null;
										}}
										variant="outline"
										class="flex-1"
										disabled={deleting}
									>
										Cancel
									</Button>
									<Button
										onclick={handleDeleteVault}
										variant="destructive"
										class="flex-1"
										disabled={!isDeleteConfirmValid}
									>
										{#if deleting}
											<span class="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-background mr-2"></span>
											Deleting...
										{:else}
											Delete Permanently
										{/if}
									</Button>
								</div>
							</div>
						{/if}
					</div>
				</section>
			{/if}
		</div>
	</div>
</div>

