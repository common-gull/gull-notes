<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { Button } from '$lib/components/ui/button';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import Menu from '@lucide/svelte/icons/menu';
	import Lock from '@lucide/svelte/icons/lock';
	import Settings from '@lucide/svelte/icons/settings';
	import PanelLeftClose from '@lucide/svelte/icons/panel-left-close';
	import PanelLeft from '@lucide/svelte/icons/panel-left';
	import Sun from '@lucide/svelte/icons/sun';
	import Moon from '@lucide/svelte/icons/moon';
	import EllipsisVertical from '@lucide/svelte/icons/ellipsis-vertical';
	import { lockVault } from '$lib/stores/vault';
	import { theme, getResolvedTheme } from '$lib/stores/theme';
	import { t } from '$lib/i18n';

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
		await goto(resolve('/vault/select'));
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
			title={sidebarCollapsed ? $t('titleBar.expandSidebar') : $t('titleBar.collapseSidebar')}
		>
			{#if sidebarCollapsed}
				<PanelLeft class="h-5 w-5" />
			{:else}
				<PanelLeftClose class="h-5 w-5" />
			{/if}
		</Button>
	{/if}

	<div class="flex items-baseline gap-2">
		<h1 class="text-xl font-semibold">{$t('common.appName')}</h1>
		{#if vaultName}
			<span class="hidden text-sm text-muted-foreground sm:inline">• {vaultName}</span>
		{/if}
	</div>

	<div class="ml-auto flex items-center gap-2">
		{#if showMenuButton}
			<!-- Mobile: Dropdown menu -->
			<DropdownMenu.Root>
				<DropdownMenu.Trigger>
					{#snippet child({ props })}
						<Button variant="ghost" size="icon" {...props}>
							<EllipsisVertical class="h-5 w-5" />
						</Button>
					{/snippet}
				</DropdownMenu.Trigger>
				<DropdownMenu.Content align="end">
					<DropdownMenu.Item onclick={handleThemeToggle}>
						{#if isDark}
							<Sun class="mr-2 h-4 w-4" />
							{$t('titleBar.lightMode')}
						{:else}
							<Moon class="mr-2 h-4 w-4" />
							{$t('titleBar.darkMode')}
						{/if}
					</DropdownMenu.Item>
					<DropdownMenu.Item onclick={handleSettings}>
						<Settings class="mr-2 h-4 w-4" />
						{$t('titleBar.settings')}
					</DropdownMenu.Item>
					<DropdownMenu.Separator />
					<DropdownMenu.Item onclick={handleLock}>
						<Lock class="mr-2 h-4 w-4" />
						{$t('vault.lockVault')}
					</DropdownMenu.Item>
				</DropdownMenu.Content>
			</DropdownMenu.Root>
		{:else}
			<!-- Desktop: Icon buttons -->
			<Button
				variant="ghost"
				size="icon"
				title={isDark ? $t('titleBar.switchToLight') : $t('titleBar.switchToDark')}
				onclick={handleThemeToggle}
			>
				{#if isDark}
					<Sun class="h-5 w-5" />
				{:else}
					<Moon class="h-5 w-5" />
				{/if}
			</Button>
			<Button variant="ghost" size="icon" title={$t('titleBar.settings')} onclick={handleSettings}>
				<Settings class="h-5 w-5" />
			</Button>
			<Button variant="ghost" size="icon" title={$t('vault.lockVault')} onclick={handleLock}>
				<Lock class="h-5 w-5" />
			</Button>
		{/if}
	</div>
</header>
