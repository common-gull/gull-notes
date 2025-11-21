<script lang="ts">
	import type { Note } from '$lib/types';
	import { selectedNoteId } from '$lib/stores/notes';

	interface Props {
		note: Omit<Note, 'content'>;
		onclick?: () => void;
	}

	let { note, onclick }: Props = $props();

	const isSelected = $derived($selectedNoteId === note.id);

	function formatDate(timestamp: number): string {
		const date = new Date(timestamp);
		const now = new Date();
		const diff = now.getTime() - date.getTime();
		const days = Math.floor(diff / (1000 * 60 * 60 * 24));

		if (days === 0) {
			return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
		} else if (days === 1) {
			return 'Yesterday';
		} else if (days < 7) {
			return `${days} days ago`;
		} else {
			return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
		}
	}
</script>

<button
	class="w-full text-left px-3 py-2 rounded-md transition-colors hover:bg-accent"
	class:bg-accent={isSelected}
	class:text-accent-foreground={isSelected}
	onclick={onclick}
	type="button"
>
	<div class="flex flex-col gap-1">
		<div class="font-medium text-sm truncate">
			{note.metadata.title || 'Untitled Note'}
		</div>
		<div class="flex items-center justify-between">
			<div class="text-xs text-muted-foreground">
				{formatDate(note.updatedAt)}
			</div>
			{#if note.metadata.tags && note.metadata.tags.length > 0}
				<div class="flex gap-1">
					{#each note.metadata.tags.slice(0, 2) as tag}
						<span class="text-xs bg-secondary text-secondary-foreground px-1.5 py-0.5 rounded">
							{tag}
						</span>
					{/each}
					{#if note.metadata.tags.length > 2}
						<span class="text-xs text-muted-foreground">+{note.metadata.tags.length - 2}</span>
					{/if}
				</div>
			{/if}
		</div>
	</div>
</button>

