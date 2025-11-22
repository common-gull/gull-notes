<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import {
		Menu,
		Search,
		Lock,
		Settings,
		PanelLeftClose,
		PanelLeft,
		Sun,
		Moon
	} from 'lucide-svelte';
	import { searchQuery } from '$lib/stores/notes';
	import { lockVault } from '$lib/stores/vault';
	import { theme, getResolvedTheme } from '$lib/stores/theme';

	interface Props {
		onMenuClick?: () => void;
		showMenuButton?: boolean;
		onToggleSidebar?: () => void;
		sidebarCollapsed?: boolean;
		vaultName?: string;
	}

	let {
		onMenuClick,
		showMenuButton = false,
		onToggleSidebar,
		sidebarCollapsed = false,
		vaultName
	}: Props = $props();

	async function handleLock() {
		lockVault();
		await goto(resolve('/'));
	}

	async function handleSettings() {
		await goto(resolve('/vault/settings'));
	}

	function handleThemeToggle() {
		theme.toggle();
	}

	let isDark = $derived(getResolvedTheme($theme) === 'dark');
</script>

<header class="flex items-center gap-4 border-b bg-background px-4 py-3">
	{#if showMenuButton}
		<Button variant="ghost" size="icon" onclick={onMenuClick}>
			<Menu class="h-5 w-5" />
		</Button>
	{:else if onToggleSidebar}
		<Button
			variant="ghost"
			size="icon"
			onclick={onToggleSidebar}
			title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
		>
			{#if sidebarCollapsed}
				<PanelLeft class="h-5 w-5" />
			{:else}
				<PanelLeftClose class="h-5 w-5" />
			{/if}
		</Button>
	{/if}

	<div class="flex items-center gap-2">
		<h1 class="text-xl font-semibold">Gull Notes</h1>
		{#if vaultName}
			<span class="text-sm text-muted-foreground">• {vaultName}</span>
		{/if}
	</div>

	{#if !showMenuButton}
		<div class="mx-auto max-w-md flex-1">
			<div class="relative">
				<Search
					class="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform text-muted-foreground"
				/>
				<Input type="search" placeholder="Search notes..." class="pl-9" bind:value={$searchQuery} />
			</div>
		</div>
	{/if}

	<div class="flex items-center gap-2 {showMenuButton ? 'ml-auto' : ''}">
		<Button
			variant="ghost"
			size="icon"
			title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
			onclick={handleThemeToggle}
		>
			{#if isDark}
				<Sun class="h-5 w-5" />
			{:else}
				<Moon class="h-5 w-5" />
			{/if}
		</Button>
		<Button variant="ghost" size="icon" title="Settings" onclick={handleSettings}>
			<Settings class="h-5 w-5" />
		</Button>
		<Button variant="ghost" size="icon" title="Lock Vault" onclick={handleLock}>
			<Lock class="h-5 w-5" />
		</Button>
	</div>
</header>
