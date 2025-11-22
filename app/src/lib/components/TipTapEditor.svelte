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
	import Image from '@tiptap/extension-image';

	let element = $state<HTMLElement>();
	let editorState = $state<{ editor: Editor | null }>({ editor: null });
	let currentNoteId = $state<string | null>(null);
	let saveTimeout: ReturnType<typeof setTimeout> | null = null;
	let loadingNote = $state<boolean>(false);
	let loadingPromise: Promise<void> | null = null;

	// Helper function to convert File/Blob to base64 data URL
	async function fileToBase64(file: File): Promise<string> {
		return new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = () => resolve(reader.result as string);
			reader.onerror = reject;
			reader.readAsDataURL(file);
		});
	}

	// Helper function to insert image into editor
	async function insertImage(view: any, file: File, pos?: number) {
		try {
			const base64 = await fileToBase64(file);
			const { schema } = view.state;
			const node = schema.nodes.image.create({ src: base64 });
			
			const transaction = pos !== undefined
				? view.state.tr.insert(pos, node)
				: view.state.tr.replaceSelectionWith(node);
			
			view.dispatch(transaction);
		} catch (error) {
			console.error('Failed to process image:', error);
		}
	}

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
			extensions: [
				StarterKit,
				Image.configure({
					inline: true,
					allowBase64: true
				})
			],
			content: '<p>Select or create a note to start editing</p>',
			onTransaction: () => {
				// Force re-render for reactivity
				editorState = { editor: editorState.editor };
			},
			onUpdate: () => {
				debouncedSave();
			},
			editorProps: {
				handlePaste: (view, event) => {
					const items = event.clipboardData?.items;
					if (!items) return false;

					// Check if there's an image in the clipboard
					for (let i = 0; i < items.length; i++) {
						const item = items[i];
						if (item.type.startsWith('image/')) {
							const file = item.getAsFile();
							if (file) {
								event.preventDefault();
								insertImage(view, file);
								return true;
							}
						}
					}
					return false;
				},
				handleDrop: (view, event) => {
					const files = event.dataTransfer?.files;
					if (!files || files.length === 0) return false;

					// Check if there's an image in the dropped files
					for (let i = 0; i < files.length; i++) {
						const file = files[i];
						if (file.type.startsWith('image/')) {
							// Get the position where the image was dropped
							const coordinates = view.posAtCoords({
								left: event.clientX,
								top: event.clientY
							});
							
							// Only handle the event if we have valid coordinates
							if (coordinates) {
								event.preventDefault();
								insertImage(view, file, coordinates.pos);
								return true;
							}
							
							// If coordinates are invalid, let default behavior handle it
							return false;
						}
					}
					return false;
				}
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

	:global(.ProseMirror img) {
		max-width: 100%;
		height: auto;
		border-radius: 0.5rem;
		margin: 1rem 0;
		cursor: pointer;
	}

	:global(.ProseMirror img.ProseMirror-selectednode) {
		outline: 3px solid var(--color-primary);
		outline-offset: 2px;
	}

	/* Reduce excessive spacing in lists */
	:global(.ProseMirror ul),
	:global(.ProseMirror ol) {
		margin-top: 0.5rem;
		margin-bottom: 0.5rem;
	}

	:global(.ProseMirror ul li),
	:global(.ProseMirror ol li) {
		margin-top: 0.125rem;
		margin-bottom: 0.125rem;
	}

	:global(.ProseMirror ul li p),
	:global(.ProseMirror ol li p) {
		margin-top: 0;
		margin-bottom: 0;
	}
</style>

