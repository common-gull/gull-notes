<script lang="ts">
	import { goto } from '$app/navigation';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Menu, Search, Lock, Settings } from 'lucide-svelte';
	import { searchQuery } from '$lib/stores/notes';
	import { lockVault } from '$lib/stores/vault';

	interface Props {
		onMenuClick?: () => void;
		showMenuButton?: boolean;
		vaultName?: string;
	}

	let { onMenuClick, showMenuButton = false, vaultName }: Props = $props();

	async function handleLock() {
		lockVault();
		await goto('/');
	}

	async function handleSettings() {
		await goto('/vault/settings');
	}
</script>

<header class="flex items-center gap-4 border-b bg-background px-4 py-3">
	{#if showMenuButton}
		<Button variant="ghost" size="icon" onclick={onMenuClick}>
			<Menu class="h-5 w-5" />
		</Button>
	{/if}

	<div class="flex items-center gap-2">
		<h1 class="text-xl font-semibold">Gull Notes</h1>
		{#if vaultName}
			<span class="text-sm text-muted-foreground">• {vaultName}</span>
		{/if}
	</div>

	<div class="mx-auto max-w-md flex-1">
		<div class="relative">
			<Search
				class="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform text-muted-foreground"
			/>
			<Input type="search" placeholder="Search notes..." class="pl-9" bind:value={$searchQuery} />
		</div>
	</div>

	<div class="flex items-center gap-2">
		<Button variant="ghost" size="icon" title="Settings" onclick={handleSettings}>
			<Settings class="h-5 w-5" />
		</Button>
		<Button variant="ghost" size="icon" title="Lock Vault" onclick={handleLock}>
			<Lock class="h-5 w-5" />
		</Button>
	</div>
</header>
