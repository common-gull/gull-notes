<script lang="ts">
	import { onMount } from 'svelte';
	import TitleBar from '$lib/components/TitleBar.svelte';
	import Sidebar from '$lib/components/Sidebar.svelte';
	import TipTapEditor from '$lib/components/TipTapEditor.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import VaultSelector from '$lib/components/VaultSelector.svelte';
	import PasswordPrompt from '$lib/components/PasswordPrompt.svelte';
	import CreateVaultDialog from '$lib/components/CreateVaultDialog.svelte';
	import SettingsDialog from '$lib/components/SettingsDialog.svelte';
	import { filteredNotes, notesLoading, setActiveDatabase, setupDatabaseHooks } from '$lib/stores/notes';
	import { getVaultMetadata } from '$lib/services/vaults';
	import { sessionKeyManager } from '$lib/services/encryption';
	import type { NotesDatabase } from '$lib/db';

	type AuthState = 'selecting' | 'creating' | 'unlocking' | 'unlocked';

	let authState = $state<AuthState>('selecting');
	let selectedVaultId = $state<string | null>(null);
	let selectedVaultName = $state<string>('');
	let currentDb = $state<NotesDatabase | null>(null);
	let currentVaultName = $state<string>('');
	let showSettings = $state(false);

	let isMobile = $state(false);
	let mobileMenuOpen = $state(false);

	function handleResize() {
		isMobile = window.innerWidth < 768;
	}

	function toggleMobileMenu() {
		mobileMenuOpen = !mobileMenuOpen;
	}

	async function handleSelectVault(vaultId: string) {
		selectedVaultId = vaultId;
		const metadata = await getVaultMetadata(vaultId);
		selectedVaultName = metadata?.name || 'Unknown Vault';
		authState = 'unlocking';
	}

	function handleCreateVault() {
		authState = 'creating';
	}

	function handleCancelCreate() {
		authState = 'selecting';
	}

	function handleCancelUnlock() {
		selectedVaultId = null;
		selectedVaultName = '';
		authState = 'selecting';
	}

	async function handleVaultCreated(vaultId: string, db: NotesDatabase) {
		selectedVaultId = vaultId;
		currentDb = db;
		setActiveDatabase(db);
		setupDatabaseHooks(db);
		
		// Get the vault name for display
		const metadata = await getVaultMetadata(vaultId);
		currentVaultName = metadata?.name || 'Unknown Vault';
		
		authState = 'unlocked';
	}

	function handleVaultUnlocked(db: NotesDatabase) {
		currentDb = db;
		setActiveDatabase(db);
		setupDatabaseHooks(db);
		currentVaultName = selectedVaultName;
		authState = 'unlocked';
	}

	function handleLockVault() {
		// Clear the active database reference first
		setActiveDatabase(null);
		
		// Clear the session key
		sessionKeyManager.clearKey();
		
		// Close the current database
		if (currentDb) {
			currentDb.close();
			currentDb = null;
		}
		
		// Reset state
		selectedVaultId = null;
		selectedVaultName = '';
		currentVaultName = '';
		showSettings = false;
		authState = 'selecting';
	}

	function handleOpenSettings() {
		showSettings = true;
	}

	function handleCloseSettings() {
		showSettings = false;
	}

	async function handlePasswordChanged(newVaultId: string) {
		showSettings = false;
		
		// Lock the vault and clear session
		handleLockVault();
		
		// Pre-select the new vault for convenience
		const metadata = await getVaultMetadata(newVaultId);
		if (metadata) {
			selectedVaultId = newVaultId;
			selectedVaultName = metadata.name;
			authState = 'unlocking';
		}
	}

	onMount(() => {
		// Set initial mobile state
		handleResize();

		// Listen for resize events
		window.addEventListener('resize', handleResize);

		return () => {
			window.removeEventListener('resize', handleResize);
		};
	});
</script>

{#if authState === 'selecting'}
	<VaultSelector onSelectVault={handleSelectVault} onCreateVault={handleCreateVault} />
{:else if authState === 'creating'}
	<CreateVaultDialog onCreated={handleVaultCreated} onCancel={handleCancelCreate} />
{:else if authState === 'unlocking' && selectedVaultId}
	<PasswordPrompt
		vaultId={selectedVaultId}
		vaultName={selectedVaultName}
		onUnlock={handleVaultUnlocked}
		onCancel={handleCancelUnlock}
	/>
{:else if authState === 'unlocked'}
	<div class="h-screen flex flex-col">
		<TitleBar 
			onMenuClick={toggleMobileMenu} 
			showMenuButton={isMobile}
			onLock={handleLockVault}
			onSettings={handleOpenSettings}
			vaultName={currentVaultName}
		/>

		<div class="flex flex-1 overflow-hidden">
			{#if isMobile}
				<!-- Mobile: Sheet sidebar -->
				<Sidebar {isMobile} open={mobileMenuOpen} onOpenChange={(open) => (mobileMenuOpen = open)} />
			{:else}
				<!-- Desktop: Fixed sidebar -->
				<Sidebar {isMobile} />
			{/if}

			<!-- Main content area -->
			<main class="flex-1 overflow-hidden">
				{#if $notesLoading}
					<EmptyState />
				{:else if $filteredNotes.length > 0}
					<TipTapEditor />
				{:else}
					<EmptyState />
				{/if}
			</main>
		</div>

		{#if showSettings && selectedVaultId}
			<SettingsDialog 
				vaultId={selectedVaultId}
				vaultName={currentVaultName}
				onClose={handleCloseSettings}
				onPasswordChanged={handlePasswordChanged}
			/>
		{/if}
	</div>
{/if}