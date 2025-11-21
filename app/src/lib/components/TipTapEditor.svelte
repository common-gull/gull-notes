<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { Editor } from '@tiptap/core';
	import StarterKit from '@tiptap/starter-kit';
	import EditorToolbar from './EditorToolbar.svelte';
	import { selectedNoteId, loadNoteContent } from '$lib/stores/notes';
	import { db } from '$lib/db';
	import { encryptData, sessionKeyManager } from '$lib/services/encryption';
	import type { DecryptedMetadata, DecryptedContent } from '$lib/types';

	let element = $state<HTMLElement>();
	let editorState = $state<{ editor: Editor | null }>({ editor: null });
	let currentNoteId = $state<string | null>(null);
	let saveTimeout: ReturnType<typeof setTimeout> | null = null;

	// Watch for note selection changes
	$effect(() => {
		if ($selectedNoteId !== currentNoteId) {
			loadNote($selectedNoteId);
		}
	});

	async function loadNote(noteId: string | null) {
		if (!noteId || !editorState.editor) return;

		const note = await loadNoteContent(noteId);
		if (note) {
			editorState.editor.commands.setContent(note.content.body);
			currentNoteId = noteId;
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
			saveNote();
		}, 1000); // Save 1 second after user stops typing
	}

	onMount(() => {
		if (!element) return;

		editorState.editor = new Editor({
			element: element,
			extensions: [StarterKit],
			content: '<p>Select or create a note to start editing</p>',
			onTransaction: () => {
				// Force re-render for reactivity
				editorState = { editor: editorState.editor };
			},
			onUpdate: () => {
				debouncedSave();
			}
		});

		// Load note if one is selected
		if ($selectedNoteId) {
			loadNote($selectedNoteId);
		}
	});

	onDestroy(() => {
		if (saveTimeout) {
			clearTimeout(saveTimeout);
		}
		editorState.editor?.destroy();
	});
</script>

<div class="flex flex-col h-full">
	<EditorToolbar editor={editorState.editor} />
	<div class="flex-1 overflow-auto">
		<div bind:this={element} class="prose prose-sm max-w-none p-6 min-h-full"></div>
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

