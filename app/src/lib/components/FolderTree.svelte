<script lang="ts">
	import type { Folder } from '$lib/types';
	import { toggleFolder, expandedFolders } from '$lib/stores/notes';
	import { ChevronRight, ChevronDown, Folder as FolderIcon } from 'lucide-svelte';
	import FolderTree from './FolderTree.svelte';

	interface Props {
		folders: Folder[];
		level?: number;
	}

	let { folders, level = 0 }: Props = $props();
</script>

<div class="folder-tree" style="padding-left: {level * 12}px">
	{#each folders as folder (folder.id)}
		<div class="folder-item">
			<button
				class="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-accent transition-colors text-sm"
				onclick={() => toggleFolder(folder.id)}
				type="button"
			>
				{#if folder.children && folder.children.length > 0}
					{#if $expandedFolders.has(folder.id)}
						<ChevronDown class="h-4 w-4 text-muted-foreground" />
					{:else}
						<ChevronRight class="h-4 w-4 text-muted-foreground" />
					{/if}
				{:else}
					<span class="w-4"></span>
				{/if}
				<FolderIcon class="h-4 w-4 text-muted-foreground" />
				<span class="flex-1 text-left truncate">{folder.name}</span>
			</button>

			{#if folder.children && folder.children.length > 0 && $expandedFolders.has(folder.id)}
				<FolderTree folders={folder.children} level={level + 1} />
			{/if}
		</div>
	{/each}
</div>

<style>
	.folder-tree {
		display: flex;
		flex-direction: column;
	}

	.folder-item {
		display: flex;
		flex-direction: column;
	}
</style>

