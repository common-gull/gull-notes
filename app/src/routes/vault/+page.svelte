<script lang="ts">
	import TipTapEditor from '$lib/components/TipTapEditor.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import { filteredNotes, selectedNoteId } from '$lib/stores/notes';

	// Auto-select first note when notes are loaded
	$effect(() => {
		if ($filteredNotes.length > 0 && !$selectedNoteId) {
			selectedNoteId.set($filteredNotes[0].id);
		}
	});
</script>

{#if $filteredNotes.length > 0 && $selectedNoteId}
	<TipTapEditor />
{:else}
	<EmptyState />
{/if}
