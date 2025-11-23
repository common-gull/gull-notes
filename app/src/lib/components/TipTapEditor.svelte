<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { Editor } from '@tiptap/core';
	import type { EditorView } from '@tiptap/pm/view';
	import StarterKit from '@tiptap/starter-kit';
	import EditorToolbar from './EditorToolbar.svelte';
	import EditorSkeleton from './EditorSkeleton.svelte';
	import NoteHeader from './NoteHeader.svelte';
	import LinkContextMenu from './LinkContextMenu.svelte';
	import LinkDialog from './LinkDialog.svelte';
	import {
		selectedNoteId,
		loadNoteContent,
		getActiveDatabase,
		notesWithMetadata
	} from '$lib/stores/notes';
	import { encryptData, sessionKeyManager } from '$lib/services/encryption';
	import type { DecryptedMetadata, DecryptedContent } from '$lib/types';
	import Image from '@tiptap/extension-image';
	import Emoji, { gitHubEmojis } from '@tiptap/extension-emoji';
	import { Markdown } from '@tiptap/markdown';

	let element = $state<HTMLElement>();
	let editorState = $state<{ editor: Editor | null }>({ editor: null });
	let currentNoteId = $state<string | null>(null);
	let currentMetadata = $state<DecryptedMetadata | null>(null);
	let saveTimeout: ReturnType<typeof setTimeout> | null = null;
	let loadingNote = $state<boolean>(false);
	let loadingPromise: Promise<void> | null = null;
	let lastContentHash = $state<string>('');

	// Link context menu state
	let showLinkContextMenu = $state(false);
	let linkContextMenuPosition = $state({ x: 0, y: 0 });
	let contextLinkUrl = $state('');

	// Link dialog state
	let showLinkDialog = $state(false);
	let linkDialogUrl = $state('');

	// Watch for metadata changes from the store
	$effect(() => {
		if (currentNoteId) {
			const note = $notesWithMetadata.find((n) => n.id === currentNoteId);
			if (note) {
				currentMetadata = note.metadata;
			}
		} else {
			currentMetadata = null;
		}
	});

	// Simple hash function for content comparison
	async function hashContent(content: string): Promise<string> {
		const encoder = new TextEncoder();
		const data = encoder.encode(content);
		const hashBuffer = await crypto.subtle.digest('SHA-256', data);
		const hashArray = Array.from(new Uint8Array(hashBuffer));
		return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
	}

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
	async function insertImage(view: EditorView, file: File, pos?: number) {
		try {
			const base64 = await fileToBase64(file);
			const { schema } = view.state;
			const node = schema.nodes.image.create({ src: base64 });

			const transaction =
				pos !== undefined
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
			// Cancel debounced save since we're saving immediately
			if (saveTimeout) {
				clearTimeout(saveTimeout);
				saveTimeout = null;
			}

			// Cancel previous load if still in progress
			if (loadingPromise) {
				loadingNote = false;
			}

			// Save current note before switching (if there is one)
			// Always load new note regardless of save success/failure
			if (currentNoteId) {
				loadingPromise = saveNote()
					.catch((error) => {
						console.error('Failed to save note before switching:', error);
						// TODO: Show user notification about failed save
					})
					.then(() => loadNote($selectedNoteId));
			} else {
				loadingPromise = loadNote($selectedNoteId);
			}
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
				// Store hash of loaded content
				lastContentHash = await hashContent(note.content.body);
			} else {
				// If note couldn't be loaded, show empty editor
				editorState.editor.commands.setContent('');
				currentNoteId = noteId;
				lastContentHash = await hashContent('');
			}
		} catch (error) {
			console.error('Failed to load note:', error);
			// Show empty editor on error
			editorState.editor.commands.setContent('');
			currentNoteId = noteId;
			lastContentHash = await hashContent('');
		} finally {
			loadingNote = false;
			loadingPromise = null;
		}
	}

	async function saveNote() {
		if (!editorState.editor || !currentNoteId) return;

		const db = getActiveDatabase();
		if (!db) {
			// Silently ignore - vault is being closed/locked
			return;
		}

		const key = sessionKeyManager.getKey();
		if (!key) {
			// Silently ignore - vault is being closed/locked
			return;
		}

		const content = editorState.editor.getHTML();

		// Compare hash to check if content actually changed
		const currentHash = await hashContent(content);
		if (currentHash === lastContentHash) {
			return; // No changes, skip save
		}

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

		// Update hash after successful save
		lastContentHash = currentHash;
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
		}, 500);
	}

	function handleLinkClick(event: MouseEvent) {
		const target = event.target as HTMLElement;
		// Check if the clicked element is a link or is inside a link
		const linkElement = target.closest('a');
		if (linkElement) {
			event.preventDefault();
			event.stopPropagation();
			const url = linkElement.getAttribute('href');
			if (url) {
				contextLinkUrl = url;
				linkContextMenuPosition = { x: event.clientX, y: event.clientY };
				showLinkContextMenu = true;
			}
		}
	}

	function handleEditLink() {
		linkDialogUrl = contextLinkUrl;
		showLinkDialog = true;
	}

	function handleRemoveLink() {
		if (!editorState.editor) return;
		// Find and remove the link
		editorState.editor.chain().focus().extendMarkRange('link').unsetLink().run();
	}

	function handleLinkSubmit(url: string) {
		if (!editorState.editor) return;
		editorState.editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
	}

	onMount(() => {
		if (!element) return;

		editorState.editor = new Editor({
			element: element,
			extensions: [
				StarterKit.configure({
					link: {
						openOnClick: false
					}
				}),
				Image.configure({
					inline: true,
					allowBase64: true
				}),
				Emoji.configure({
					emojis: gitHubEmojis,
					enableEmoticons: true
				}),
				Markdown
			],
			content: '<p>Select or create a note to start editing</p>',
			onTransaction: () => {
				// Force re-render for reactivity
				editorState = { editor: editorState.editor };
			},
			onUpdate: ({ transaction }) => {
				// Only trigger save if document content changed
				if (transaction.docChanged) {
					debouncedSave();
				}
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
		// Clear any pending debounced save
		if (saveTimeout) {
			clearTimeout(saveTimeout);
		}

		// Save immediately if there's a current note
		// Note: This is synchronous destruction, but saveNote is async
		// We can't await here, but the IndexedDB operation will still complete
		if (currentNoteId && editorState.editor) {
			saveNote().catch((error) => {
				console.error('Failed to save note on destroy:', error);
			});
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

	<div class="flex h-full flex-col" class:opacity-0={loadingNote}>
		{#if currentNoteId && currentMetadata}
			<NoteHeader noteId={currentNoteId} metadata={currentMetadata} />
		{/if}
		<EditorToolbar editor={editorState.editor} />
		<div
			class="editor-container flex-1 overflow-auto"
			role="textbox"
			tabindex="-1"
			onclick={(e) => {
				// Handle link clicks
				handleLinkClick(e);

				// Focus editor when clicking anywhere in the container
				if (editorState.editor && !editorState.editor.isFocused) {
					// Check if click is on the container or prose wrapper, not on actual content
					const target = e.target as HTMLElement;
					if (
						target.classList.contains('editor-container') ||
						target.classList.contains('prose') ||
						target.classList.contains('ProseMirror')
					) {
						editorState.editor.commands.focus('end');
					}
				}
			}}
			onkeydown={(e) => {
				if (e.key === 'Enter' || e.key === ' ') {
					const target = e.target as HTMLElement;
					if (target.classList.contains('editor-container')) {
						e.preventDefault();
						if (editorState.editor) {
							editorState.editor.commands.focus('end');
						}
					}
				}
			}}
		>
			<div bind:this={element} class="prose prose-sm min-h-full max-w-none p-6"></div>
		</div>
	</div>

	<LinkContextMenu
		bind:open={showLinkContextMenu}
		url={contextLinkUrl}
		position={linkContextMenuPosition}
		onClose={() => (showLinkContextMenu = false)}
		onEdit={handleEditLink}
		onRemove={handleRemoveLink}
	/>

	<LinkDialog
		bind:open={showLinkDialog}
		initialUrl={linkDialogUrl}
		onClose={() => (showLinkDialog = false)}
		onSubmit={handleLinkSubmit}
		onRemove={handleRemoveLink}
	/>
</div>

<style>
	:global(.ProseMirror) {
		outline: none;
		min-height: 100%;
		cursor: text;
	}

	/* Ensure the prose container is clickable and fills space */
	.prose {
		cursor: text;
	}

	/* Make all clickable areas focus the editor */
	.prose:empty::before {
		content: '';
		display: block;
		min-height: 200px;
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

	/* Emoji extension styles - make emojis inline */
	:global(.ProseMirror [data-type='emoji'] img) {
		display: inline-block;
		height: 1.2em;
		width: 1.2em;
		margin: 0 0.05em;
		vertical-align: -0.28em;
		border-radius: 0;
	}

	/* Link styles */
	:global(.ProseMirror a) {
		color: var(--color-primary);
		text-decoration: underline;
		cursor: pointer;
	}

	:global(.ProseMirror a:hover) {
		text-decoration: none;
	}

	/* Underline styles */
	:global(.ProseMirror u) {
		text-decoration: underline;
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
