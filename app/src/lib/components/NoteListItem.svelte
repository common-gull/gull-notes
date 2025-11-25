<script lang="ts">
	import type { Note } from '$lib/types';
	import { selectedNoteId } from '$lib/stores/notes';
	import { t } from '$lib/i18n';

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
			return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
		} else if (days === 1) {
			return $t('notes.date.yesterday');
		} else if (days < 7) {
			return $t('notes.date.daysAgo', { count: days });
		} else {
			return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
		}
	}
</script>

<button
	class="w-full rounded-md px-3 py-2 text-left transition-colors hover:bg-accent"
	class:bg-accent={isSelected}
	class:text-accent-foreground={isSelected}
	{onclick}
	type="button"
>
	<div class="flex flex-col gap-1">
		<div class="truncate text-sm font-medium">
			{note.metadata.title || $t('notes.untitled')}
		</div>
		<div class="flex items-center justify-between">
			<div class="text-xs text-muted-foreground">
				{formatDate(note.updatedAt)}
			</div>
			{#if note.metadata.tags && note.metadata.tags.length > 0}
				<div class="flex gap-1">
					{#each note.metadata.tags.slice(0, 2) as tag (tag)}
						<span class="rounded bg-secondary px-1.5 py-0.5 text-xs text-secondary-foreground">
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
