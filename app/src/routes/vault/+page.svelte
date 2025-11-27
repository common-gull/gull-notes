<script lang="ts">
	import EmptyState from '$lib/components/EmptyState.svelte';
	import EditorSkeleton from '$lib/components/EditorSkeleton.svelte';
	import { filteredNotes, selectedNoteId, notesWithMetadata } from '$lib/stores/notes';

	const TipTapEditor = import('$lib/components/TipTapEditor.svelte');

	// Auto-select first note when notes are loaded (only if no note is selected)
	$effect(() => {
		if ($filteredNotes.length > 0 && !$selectedNoteId) {
			selectedNoteId.set($filteredNotes[0].id);
		}
	});

	// Check if there are any notes at all (not just filtered ones)
	let hasNotes = $derived($notesWithMetadata.length > 0);
</script>

{#if hasNotes && $selectedNoteId}
	{#await TipTapEditor}
		<EditorSkeleton />
	{:then module}
		<module.default />
	{/await}
{:else}
	<EmptyState />
{/if}
