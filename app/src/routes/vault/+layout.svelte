<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/stores';
	import TitleBar from '$lib/components/TitleBar.svelte';
	import Sidebar from '$lib/components/Sidebar.svelte';
	import { activeVault } from '$lib/stores/vault';

	let { children } = $props();

	let isMobile = $state(false);
	let mobileMenuOpen = $state(false);

	function handleResize() {
		isMobile = window.innerWidth < 768;
	}

	function toggleMobileMenu() {
		mobileMenuOpen = !mobileMenuOpen;
	}

	// Routes that don't require an unlocked vault
	const publicVaultRoutes = ['/vault/unlock', '/vault/create'];

	onMount(() => {
		// Check current route
		const currentPath = $page.url.pathname;
		const isPublicRoute = publicVaultRoutes.includes(currentPath);

		// Only check for active vault on protected routes
		if (!isPublicRoute && !$activeVault) {
			goto(resolve('/'));
			return;
		}

		// Set initial mobile state
		handleResize();

		// Listen for resize events
		window.addEventListener('resize', handleResize);

		return () => {
			window.removeEventListener('resize', handleResize);
		};
	});

	// Determine if we should show the vault UI (TitleBar + Sidebar)
	let showVaultUI = $derived($activeVault && !publicVaultRoutes.includes($page.url.pathname));
</script>

{#if showVaultUI && $activeVault}
	<div class="flex h-screen flex-col">
		<TitleBar
			onMenuClick={toggleMobileMenu}
			showMenuButton={isMobile}
			vaultName={$activeVault.name}
		/>

		<div class="flex flex-1 overflow-hidden">
			{#if isMobile}
				<!-- Mobile: Sheet sidebar -->
				<Sidebar
					{isMobile}
					open={mobileMenuOpen}
					onOpenChange={(open) => (mobileMenuOpen = open)}
				/>
			{:else}
				<!-- Desktop: Fixed sidebar -->
				<Sidebar {isMobile} />
			{/if}

			<!-- Main content area -->
			<main class="flex-1 overflow-hidden">
				{@render children()}
			</main>
		</div>
	</div>
{:else}
	<!-- For public routes (unlock/create), just render children without vault UI -->
	{@render children()}
{/if}
