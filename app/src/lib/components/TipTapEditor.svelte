<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { Editor } from '@tiptap/core';
	import StarterKit from '@tiptap/starter-kit';
	import EditorToolbar from './EditorToolbar.svelte';
	import EditorSkeleton from './EditorSkeleton.svelte';
	import { selectedNoteId, loadNoteContent } from '$lib/stores/notes';
	import { db } from '$lib/db';
	import { encryptData, sessionKeyManager } from '$lib/services/encryption';
	import type { DecryptedMetadata, DecryptedContent } from '$lib/types';

	let element = $state<HTMLElement>();
	let editorState = $state<{ editor: Editor | null }>({ editor: null });
	let currentNoteId = $state<string | null>(null);
	let saveTimeout: ReturnType<typeof setTimeout> | null = null;
	let loadingNote = $state<boolean>(false);
	let loadingPromise: Promise<void> | null = null;

	// Watch for note selection changes
	$effect(() => {
		if ($selectedNoteId !== currentNoteId && editorState.editor) {
			// Cancel previous load if still in progress
			if (loadingPromise) {
				loadingNote = false;
			}
			loadingPromise = loadNote($selectedNoteId);
		}
	});

	async function loadNote(noteId: string | null): Promise<void> {
		if (!noteId || !editorState.editor) return;

		loadingNote = true;
		try {
			const note = await loadNoteContent(noteId);
			// Check if this is still the current request (user didn't switch notes)
			if ($selectedNoteId !== noteId) return;
			
			if (note) {
				editorState.editor.commands.setContent(note.content.body);
				currentNoteId = noteId;
			} else {
				// If note couldn't be loaded, show empty editor
				editorState.editor.commands.setContent('');
				currentNoteId = noteId;
			}
		} catch (error) {
			console.error('Failed to load note:', error);
			// Show empty editor on error
			editorState.editor.commands.setContent('');
			currentNoteId = noteId;
		} finally {
			loadingNote = false;
			loadingPromise = null;
		}
	}

	async function saveNote() {
		if (!editorState.editor || !currentNoteId) return;

		const key = sessionKeyManager.getKey();
		if (!key) {
			console.error('No encryption key available');
			return;
		}

		const content = editorState.editor.getHTML();

		// Get current note to preserve metadata
		const existingNote = await db.notes.get(currentNoteId);
		if (!existingNote) return;

		// Decrypt current metadata
		const metadata = await import('$lib/services/encryption').then((m) =>
			m.decryptData<DecryptedMetadata>(existingNote.metaCipher, existingNote.metaIv, key)
		);

		// Encrypt updated content
		const contentData: DecryptedContent = {
			body: content
		};

		const contentEncrypted = await encryptData(contentData, key);
		const metaEncrypted = await encryptData(metadata, key);

		// Update database
		await db.notes.update(currentNoteId, {
			metaCipher: metaEncrypted.ciphertext,
			metaIv: metaEncrypted.iv,
			contentCipher: contentEncrypted.ciphertext,
			contentIv: contentEncrypted.iv,
			updatedAt: Date.now()
		});
	}

	function debouncedSave() {
		if (saveTimeout) {
			clearTimeout(saveTimeout);
		}
		saveTimeout = setTimeout(() => {
			saveNote().catch((error) => {
				console.error('Failed to save note:', error);
				// TODO: Show user notification about failed save
			});
		}, 1000); // Save 1 second after user stops typing
	}

	onMount(() => {
		if (!element) return;

		editorState.editor = new Editor({
			element: element,
			extensions: [StarterKit],
			content: 'Select or create a note to start editing<',
			onTransaction: () => {
				// Force re-render for reactivity
				editorState = { editor: editorState.editor };
			},
			onUpdate: () => {
				debouncedSave();
			}
		});

		// Initial load will be handled by $effect watching selectedNoteId
	});

	onDestroy(() => {
		if (saveTimeout) {
			clearTimeout(saveTimeout);
		}
		editorState.editor?.destroy();
	});
</script>

<div class="relative h-full">
	{#if loadingNote}
		<div class="absolute inset-0 z-10 bg-background">
			<EditorSkeleton />
		</div>
	{/if}

	<div class="flex flex-col h-full" class:opacity-0={loadingNote}>
		<EditorToolbar editor={editorState.editor} />
		<div class="flex-1 overflow-auto">
			<div bind:this={element} class="prose prose-sm max-w-none p-6 min-h-full"></div>
		</div>
	</div>
</div>

<style>
	:global(.ProseMirror) {
		outline: none;
		min-height: 100%;
	}

	:global(.ProseMirror p.is-editor-empty:first-child::before) {
		color: var(--color-muted-foreground);
		content: attr(data-placeholder);
		float: left;
		height: 0;
		pointer-events: none;
	}
</style>

