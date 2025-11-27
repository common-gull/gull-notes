<script lang="ts">
	import { Button } from './ui/button';
	import TagIcon from '@lucide/svelte/icons/tag';
	import MoreVerticalIcon from '@lucide/svelte/icons/more-vertical';
	import Trash2Icon from '@lucide/svelte/icons/trash-2';
	import Copy from '@lucide/svelte/icons/copy';
	import * as DropdownMenu from './ui/dropdown-menu';
	import TagEditorDialog from './TagEditorDialog.svelte';
	import DeleteNoteDialog from './DeleteNoteDialog.svelte';
	import { updateNoteMetadata, deleteNote, selectedNoteId } from '$lib/stores/notes';
	import type { DecryptedMetadata } from '$lib/types';
	import { toast } from 'svelte-sonner';
	import { t } from '$lib/i18n';

	interface Props {
		noteId: string;
		metadata: DecryptedMetadata;
		getMarkdown?: () => string;
	}

	let { noteId, metadata, getMarkdown }: Props = $props();

	let isEditingTitle = $state(false);
	let showTagDialog = $state(false);
	let showDeleteDialog = $state(false);
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
		const finalTitle = trimmedTitle || $t('notes.untitled');

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

	async function handleDeleteNote() {
		try {
			const nextNoteId = await deleteNote(noteId);
			showDeleteDialog = false;

			// Select the next note or clear selection
			if (nextNoteId) {
				selectedNoteId.set(nextNoteId);
			} else {
				selectedNoteId.set(null);
			}
		} catch (error) {
			console.error('Failed to delete note:', error);
		}
	}

	async function handleCopyAsMarkdown() {
		if (!getMarkdown) {
			toast.error($t('editor.copyNotAvailable'));
			return;
		}

		try {
			// Get markdown content
			const markdown = getMarkdown();

			// Include title as heading at the top
			const noteTitle = metadata.title || $t('notes.untitled');
			const fullMarkdown = `# ${noteTitle}\n\n${markdown}`;

			// Copy to clipboard
			await navigator.clipboard.writeText(fullMarkdown);

			toast.success($t('editor.noteCopied'));
		} catch (error) {
			console.error('Failed to copy note as markdown:', error);
			toast.error($t('editor.failedToCopy'));
		}
	}
</script>

<div class="border-b border-border bg-background px-6 py-3">
	<div class="flex items-center justify-between gap-4">
		<!-- Title section -->
		<div class="min-w-0 flex-1">
			{#if isEditingTitle}
				<input
					bind:this={titleInputElement}
					bind:value={editingTitleValue}
					onkeydown={handleTitleKeydown}
					onblur={handleTitleBlur}
					class="w-full border-none bg-transparent px-0 py-1 text-xl font-semibold outline-none focus:ring-0"
					placeholder={$t('notes.untitled')}
					disabled={isSaving}
				/>
			{:else}
				<button
					onclick={startEditingTitle}
					class="w-full truncate py-1 text-left text-xl font-semibold transition-colors hover:text-primary"
					type="button"
				>
					{metadata.title || $t('notes.untitled')}
				</button>
			{/if}
		</div>

		<!-- Tags and Actions section -->
		<div class="flex items-center gap-2">
			{#if metadata.tags && metadata.tags.length > 0}
				<div class="flex items-center gap-1">
					{#each metadata.tags.slice(0, 3) as tag (tag)}
						<span class="rounded bg-secondary px-2 py-1 text-xs text-secondary-foreground">
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
			<Button variant="outline" size="sm" onclick={() => (showTagDialog = true)} class="gap-1">
				<TagIcon class="h-4 w-4" />
				<span class="hidden sm:inline">{$t('tags.label')}</span>
			</Button>

			<!-- Action menu -->
			<DropdownMenu.Root>
				<DropdownMenu.Trigger>
					{#snippet child({ props })}
						<Button variant="ghost" size="icon-sm" class="h-8 w-8" {...props}>
							<MoreVerticalIcon class="h-4 w-4" />
						</Button>
					{/snippet}
				</DropdownMenu.Trigger>
				<DropdownMenu.Content align="end">
					<DropdownMenu.Item onclick={handleCopyAsMarkdown}>
						<Copy class="mr-2 h-4 w-4" />
						{$t('editor.copyAsMarkdown')}
					</DropdownMenu.Item>
					<DropdownMenu.Item
						onclick={() => (showDeleteDialog = true)}
						class="text-destructive focus:text-destructive"
					>
						<Trash2Icon class="mr-2 h-4 w-4" />
						{$t('deleteNote.deleteButton')}
					</DropdownMenu.Item>
				</DropdownMenu.Content>
			</DropdownMenu.Root>
		</div>
	</div>
</div>

{#if showTagDialog}
	<TagEditorDialog
		tags={metadata.tags}
		onSave={handleSaveTags}
		onClose={() => (showTagDialog = false)}
	/>
{/if}

{#if showDeleteDialog}
	<DeleteNoteDialog
		noteTitle={metadata.title}
		onConfirm={handleDeleteNote}
		onCancel={() => (showDeleteDialog = false)}
	/>
{/if}
