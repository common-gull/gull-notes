<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import * as Sheet from '$lib/components/ui/sheet';
	import { ScrollArea } from '$lib/components/ui/scroll-area';
	import { Separator } from '$lib/components/ui/separator';
	import { Plus, Menu, X } from 'lucide-svelte';
	import FolderTree from './FolderTree.svelte';
	import NoteListItem from './NoteListItem.svelte';
	import NoteListSkeleton from './NoteListSkeleton.svelte';
	import { filteredNotes, folders, selectedNoteId, notesLoading } from '$lib/stores/notes';
	import { db } from '$lib/db';
	import { encryptData, sessionKeyManager } from '$lib/services/encryption';
	import type { DecryptedMetadata, DecryptedContent } from '$lib/types';

	interface Props {
		isMobile?: boolean;
		open?: boolean;
		onOpenChange?: (open: boolean) => void;
	}

	let { isMobile = false, open = false, onOpenChange }: Props = $props();

	async function createNewNote() {
		const key = sessionKeyManager.getKey();
		if (!key) {
			console.error('No encryption key available');
			return;
		}

		const now = Date.now();
		const noteId = crypto.randomUUID();

		const metadata: DecryptedMetadata = {
			title: 'Untitled Note',
			tags: [],
			color: undefined
		};

		const content: DecryptedContent = {
			body: ''
		};

		const metaEncrypted = await encryptData(metadata, key);
		const contentEncrypted = await encryptData(content, key);

		await db.notes.add({
			id: noteId,
			metaCipher: metaEncrypted.ciphertext,
			metaIv: metaEncrypted.iv,
			contentCipher: contentEncrypted.ciphertext,
			contentIv: contentEncrypted.iv,
			createdAt: now,
			updatedAt: now,
			schemaVersion: 1
		});

		selectedNoteId.set(noteId);
	}

	function handleNoteClick(noteId: string) {
		selectedNoteId.set(noteId);
		if (isMobile && onOpenChange) {
			onOpenChange(false);
		}
	}
</script>

{#if isMobile}
	<Sheet.Root {open} onOpenChange={onOpenChange}>
		<Sheet.Content side="left" class="w-[280px] p-0">
			<div class="flex flex-col h-full">
				<div class="p-4 flex items-center justify-between">
					<h2 class="font-semibold text-lg">Notes</h2>
					<Button size="sm" onclick={createNewNote}>
						<Plus class="h-4 w-4" />
					</Button>
				</div>
				<Separator />
				<ScrollArea class="flex-1 px-2">
					{#if $folders && $folders.folders.length > 0}
						<div class="py-2">
							<FolderTree folders={$folders.folders} />
						</div>
						<Separator class="my-2" />
					{/if}
					<div class="py-2 space-y-1">
						{#if $notesLoading}
							<NoteListSkeleton />
						{:else if $filteredNotes.length > 0}
							{#each $filteredNotes as note (note.id)}
								<NoteListItem {note} onclick={() => handleNoteClick(note.id)} />
							{/each}
						{:else}
							<div class="text-center py-8 text-muted-foreground text-sm">
								No notes found
							</div>
						{/if}
					</div>
				</ScrollArea>
			</div>
		</Sheet.Content>
	</Sheet.Root>
{:else}
	<aside class="w-[280px] border-r bg-sidebar border-sidebar-border flex flex-col h-full">
		<div class="p-4 flex items-center justify-between">
			<h2 class="font-semibold text-lg">Notes</h2>
			<Button size="sm" onclick={createNewNote}>
				<Plus class="h-4 w-4" />
			</Button>
		</div>
		<Separator />
		<ScrollArea class="flex-1 px-2">
			{#if $folders && $folders.folders.length > 0}
				<div class="py-2">
					<FolderTree folders={$folders.folders} />
				</div>
				<Separator class="my-2" />
			{/if}
			<div class="py-2 space-y-1">
				{#if $notesLoading}
					<NoteListSkeleton />
				{:else if $filteredNotes.length > 0}
					{#each $filteredNotes as note (note.id)}
						<NoteListItem {note} onclick={() => handleNoteClick(note.id)} />
					{/each}
				{:else}
					<div class="text-center py-8 text-muted-foreground text-sm">
						No notes found
					</div>
				{/if}
			</div>
		</ScrollArea>
	</aside>
{/if}

