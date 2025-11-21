<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Menu, Search, Lock, Settings } from 'lucide-svelte';
	import { searchQuery } from '$lib/stores/notes';

	interface Props {
		onMenuClick?: () => void;
		showMenuButton?: boolean;
	}

	let { onMenuClick, showMenuButton = false }: Props = $props();
</script>

<header class="border-b bg-background px-4 py-3 flex items-center gap-4">
	{#if showMenuButton}
		<Button variant="ghost" size="icon" onclick={onMenuClick}>
			<Menu class="h-5 w-5" />
		</Button>
	{/if}

	<div class="flex items-center gap-2">
		<h1 class="text-xl font-semibold">Secure Notes</h1>
	</div>

	<div class="flex-1 max-w-md mx-auto">
		<div class="relative">
			<Search class="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
			<Input
				type="search"
				placeholder="Search notes..."
				class="pl-9"
				bind:value={$searchQuery}
			/>
		</div>
	</div>

	<div class="flex items-center gap-2">
		<Button variant="ghost" size="icon" title="Settings">
			<Settings class="h-5 w-5" />
		</Button>
		<Button variant="ghost" size="icon" title="Lock">
			<Lock class="h-5 w-5" />
		</Button>
	</div>
</header>

