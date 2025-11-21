<script lang="ts">
	import { onMount } from 'svelte';
	import TitleBar from '$lib/components/TitleBar.svelte';
	import Sidebar from '$lib/components/Sidebar.svelte';
	import TipTapEditor from '$lib/components/TipTapEditor.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import { filteredNotes } from '$lib/stores/notes';
	import { initializeEncryption } from '$lib/services/encryption';

	let isMobile = $state(false);
	let mobileMenuOpen = $state(false);

	function handleResize() {
		isMobile = window.innerWidth < 768;
	}

	function toggleMobileMenu() {
		mobileMenuOpen = !mobileMenuOpen;
	}

	onMount(() => {
		// Initialize encryption with dummy key for development
		initializeEncryption();

		// Set initial mobile state
		handleResize();

		// Listen for resize events
		window.addEventListener('resize', handleResize);

		return () => {
			window.removeEventListener('resize', handleResize);
		};
	});
</script>

<div class="h-screen flex flex-col">
	<TitleBar onMenuClick={toggleMobileMenu} showMenuButton={isMobile} />

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
			{#if $filteredNotes.length > 0}
				<TipTapEditor />
			{:else}
				<EmptyState />
			{/if}
		</main>
	</div>
</div>
