import { liveQuery } from 'dexie';
import { db } from '../db';
import type { Note, Folder, DecryptedMetadata, DecryptedContent, FolderTree } from '../types';
import { decryptData } from '../services/encryption';
import { sessionKeyManager } from '../services/encryption';
import { writable, derived, get, readable } from 'svelte/store';

/**
 * Store for all notes with decrypted metadata
 * Manually managed to work around liveQuery + key availability reactivity
 */
export const notesWithMetadata = writable<Array<Omit<Note, 'content'>>>([]);

// Function to load and decrypt all notes
async function loadAllNotes() {
	const key = sessionKeyManager.getKey();
	if (!key) {
		notesWithMetadata.set([]);
		return;
	}

	const allNotes = await db.notes.toArray();

	// Decrypt metadata for each note (lightweight)
	const notesWithMeta = await Promise.all(
		allNotes.map(async (encryptedNote) => {
			try {
				const metadata = await decryptData<DecryptedMetadata>(
					encryptedNote.metaCipher,
					encryptedNote.metaIv,
					key
				);

				// Return note info without full content
				return {
					id: encryptedNote.id,
					metadata,
					createdAt: encryptedNote.createdAt,
					updatedAt: encryptedNote.updatedAt,
					folderId: undefined // TODO: Store folder assignment
				} as Omit<Note, 'content'>;
			} catch (error) {
				console.error('Failed to decrypt note metadata:', error);
				return null;
			}
		})
	);

	// Filter out failed decryptions and sort by update time
	const result = notesWithMeta.filter((n) => n !== null).sort((a, b) => b!.updatedAt - a!.updatedAt);
	notesWithMetadata.set(result);
}

// Watch for key availability and load notes when key becomes available
sessionKeyManager.keyAvailable.subscribe((available) => {
	if (available) {
		loadAllNotes();
	}
});

// Watch for database changes using Dexie's on() events
db.notes.hook('creating', () => {
	loadAllNotes();
});

db.notes.hook('updating', () => {
	loadAllNotes();
});

db.notes.hook('deleting', () => {
	loadAllNotes();
});

/**
 * Store for the currently selected note ID
 */
export const selectedNoteId = writable<string | null>(null);

/**
 * Store for folder tree structure
 * Uses liveQuery to load from settings table
 */
export const folders = liveQuery(async () => {
	const folderSettings = await db.settings.get('folders');
	if (!folderSettings) {
		// Return default empty structure
		return {
			folders: [],
			version: 1
		} as FolderTree;
	}

	return folderSettings.data as FolderTree;
});

/**
 * Store for expanded folder IDs (UI state only, not persisted)
 */
export const expandedFolders = writable<Set<string>>(new Set());

/**
 * Helper to toggle folder expansion
 */
export function toggleFolder(folderId: string) {
	expandedFolders.update((expanded) => {
		const newSet = new Set(expanded);
		if (newSet.has(folderId)) {
			newSet.delete(folderId);
		} else {
			newSet.add(folderId);
		}
		return newSet;
	});
}

/**
 * Store for search query
 */
export const searchQuery = writable<string>('');

/**
 * Filtered notes based on search query
 * Using writable store with manual updates to avoid Observable/Readable type conflicts
 */
export const filteredNotes = writable<Array<Omit<Note, 'content'>>>([]);

// Track both stores and update filtered notes
let cachedNotes: Array<Omit<Note, 'content'>> = [];
let cachedQuery: string = '';

notesWithMetadata.subscribe((notes) => {
	cachedNotes = notes || [];
	updateFilteredNotes();
});

searchQuery.subscribe((query) => {
	cachedQuery = query;
	updateFilteredNotes();
});

function updateFilteredNotes() {
	if (!cachedNotes || cachedNotes.length === 0) {
		filteredNotes.set([]);
		return;
	}

	if (!cachedQuery || cachedQuery.trim() === '') {
		filteredNotes.set(cachedNotes);
		return;
	}

	const query = cachedQuery.toLowerCase().trim();
	const filtered = cachedNotes.filter((note) => {
		const titleMatch = note.metadata.title.toLowerCase().includes(query);
		const tagMatch = note.metadata.tags.some((tag: string) => tag.toLowerCase().includes(query));
		return titleMatch || tagMatch;
	});
	filteredNotes.set(filtered);
}

/**
 * Get full note content (heavy operation, only when viewing)
 */
export async function loadNoteContent(noteId: string): Promise<Note | null> {
	const key = sessionKeyManager.getKey();
	if (!key) {
		console.error('No encryption key available');
		return null;
	}

	const encryptedNote = await db.notes.get(noteId);
	if (!encryptedNote) {
		return null;
	}

	try {
		const metadata = await decryptData<DecryptedMetadata>(
			encryptedNote.metaCipher,
			encryptedNote.metaIv,
			key
		);

		const content = await decryptData<DecryptedContent>(
			encryptedNote.contentCipher,
			encryptedNote.contentIv,
			key
		);

		return {
			id: encryptedNote.id,
			metadata,
			content,
			createdAt: encryptedNote.createdAt,
			updatedAt: encryptedNote.updatedAt
		};
	} catch (error) {
		console.error('Failed to load note content:', error);
		return null;
	}
}

/**
 * Save folder tree to database
 */
export async function saveFolderTree(tree: FolderTree): Promise<void> {
	await db.settings.put({
		id: 'folders',
		data: tree
	});
}

