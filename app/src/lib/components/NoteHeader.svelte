<script lang="ts">
	import { Button } from './ui/button';
	import { TagIcon } from 'lucide-svelte';
	import TagEditorDialog from './TagEditorDialog.svelte';
	import { updateNoteMetadata } from '$lib/stores/notes';
	import type { DecryptedMetadata } from '$lib/types';

	interface Props {
		noteId: string;
		metadata: DecryptedMetadata;
	}

	let { noteId, metadata }: Props = $props();

	let isEditingTitle = $state(false);
	let showTagDialog = $state(false);
	let titleInputElement = $state<HTMLInputElement>();
	let isSaving = $state(false);
	let editingTitleValue = $state('');

	function startEditingTitle() {
		isEditingTitle = true;
		editingTitleValue = metadata.title;
		// Focus input after it's rendered
		setTimeout(() => {
			titleInputElement?.focus();
			titleInputElement?.select();
		}, 0);
	}

	async function saveTitle() {
		// Prevent multiple simultaneous saves
		if (isSaving) return;
		
		const trimmedTitle = editingTitleValue.trim();
		const finalTitle = trimmedTitle || 'Untitled Note';

		// Only save if changed
		if (finalTitle !== metadata.title) {
			isSaving = true;
			try {
				await updateNoteMetadata(noteId, { title: finalTitle });
			} catch (error) {
				console.error('Failed to update title:', error);
			} finally {
				isSaving = false;
			}
		}
		
		isEditingTitle = false;
	}

	function handleTitleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault();
			saveTitle();
		} else if (e.key === 'Escape') {
			isEditingTitle = false;
		}
	}

	function handleTitleBlur() {
		saveTitle();
	}

	async function handleSaveTags(tags: string[]) {
		try {
			await updateNoteMetadata(noteId, { tags });
		} catch (error) {
			console.error('Failed to update tags:', error);
		}
	}
</script>

<div class="border-b border-border bg-background px-6 py-3">
	<div class="flex items-center justify-between gap-4">
		<!-- Title section -->
		<div class="flex-1 min-w-0">
			{#if isEditingTitle}
				<input
					bind:this={titleInputElement}
					bind:value={editingTitleValue}
					onkeydown={handleTitleKeydown}
					onblur={handleTitleBlur}
					class="w-full bg-transparent border-none outline-none text-xl font-semibold px-0 py-1 focus:ring-0"
					placeholder="Untitled Note"
					disabled={isSaving}
				/>
			{:else}
				<button
					onclick={startEditingTitle}
					class="w-full text-left text-xl font-semibold truncate hover:text-primary transition-colors py-1"
					type="button"
				>
					{metadata.title || 'Untitled Note'}
				</button>
			{/if}
		</div>

		<!-- Tags section -->
		<div class="flex items-center gap-2">
			{#if metadata.tags && metadata.tags.length > 0}
				<div class="flex gap-1 items-center">
					{#each metadata.tags.slice(0, 3) as tag}
						<span class="text-xs bg-secondary text-secondary-foreground px-2 py-1 rounded">
							{tag}
						</span>
					{/each}
					{#if metadata.tags.length > 3}
						<span class="text-xs text-muted-foreground">
							+{metadata.tags.length - 3}
						</span>
					{/if}
				</div>
			{/if}
			<Button
				variant="outline"
				size="sm"
				onclick={() => showTagDialog = true}
				class="gap-1"
			>
				<TagIcon class="w-4 h-4" />
				<span class="hidden sm:inline">Tags</span>
			</Button>
		</div>
	</div>
</div>

{#if showTagDialog}
	<TagEditorDialog
		tags={metadata.tags}
		onSave={handleSaveTags}
		onClose={() => showTagDialog = false}
	/>
{/if}

