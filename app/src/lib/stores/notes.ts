import { liveQuery } from 'dexie';
import type { NotesDatabase } from '../db';
import type { Note, Folder, DecryptedMetadata, DecryptedContent, FolderTree } from '../types';
import { decryptData } from '../services/encryption';
import { sessionKeyManager } from '../services/encryption';
import { writable, derived, get, readable } from 'svelte/store';
import { activeDatabase as vaultActiveDatabase } from './vault';

/**
 * Active database instance (set by vault system)
 */
let activeDb: NotesDatabase | null = null;

/**
 * Store for all notes with decrypted metadata
 * Manually managed to work around liveQuery + key availability reactivity
 */
export const notesWithMetadata = writable<Array<Omit<Note, 'content'>>>([]);

/**
 * Store to track if notes are currently loading
 */
export const notesLoading = writable<boolean>(true);

/**
 * Set the active database instance
 * @param db Database instance from opened vault
 */
export function setActiveDatabase(db: NotesDatabase | null) {
	activeDb = db;
	if (db) {
		// Reload notes when database changes
		queueLoadAllNotes();
	} else {
		// Clear notes when database is cleared
		notesWithMetadata.set([]);
		selectedNoteId.set(null);
	}
}

// Sync with vault store's activeDatabase
vaultActiveDatabase.subscribe((db) => {
	if (db !== activeDb) {
		setActiveDatabase(db);
	}
});

// Function to load and decrypt all notes
async function loadAllNotes() {
	if (!activeDb) {
		notesWithMetadata.set([]);
		notesLoading.set(false);
		return;
	}

	const key = sessionKeyManager.getKey();
	if (!key) {
		notesWithMetadata.set([]);
		notesLoading.set(false);
		return;
	}

	notesLoading.set(true);

	const allNotes = await activeDb.notes.toArray();

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
	notesLoading.set(false);
}

// Function to update a single note in the list (when note content changes)
async function updateSingleNote(noteId: string) {
	if (!activeDb) return;

	const key = sessionKeyManager.getKey();
	if (!key) return;

	const encryptedNote = await activeDb.notes.get(noteId);
	if (!encryptedNote) return;

	try {
		const metadata = await decryptData<DecryptedMetadata>(
			encryptedNote.metaCipher,
			encryptedNote.metaIv,
			key
		);

		const updatedNote: Omit<Note, 'content'> = {
			id: encryptedNote.id,
			metadata,
			createdAt: encryptedNote.createdAt,
			updatedAt: encryptedNote.updatedAt,
			folderId: undefined
		};

		// Update the note in the current list
		notesWithMetadata.update((notes) => {
			const index = notes.findIndex((n) => n.id === noteId);
			if (index >= 0) {
				notes[index] = updatedNote;
			} else {
				notes.push(updatedNote);
			}
			// Re-sort by update time
			return notes.sort((a, b) => b.updatedAt - a.updatedAt);
		});
	} catch (error) {
		console.error('Failed to update single note:', error);
	}
}

let loadingInProgress: Promise<void> | null = null;

/**
 * Queue a load operation to prevent race conditions.
 * Ensures loads happen sequentially by chaining promises.
 */
function queueLoadAllNotes(): void {
	if (loadingInProgress) {
		// Chain the new load after the current one completes
		// This ensures sequential execution without parallel loads
		loadingInProgress = loadingInProgress.then(() => loadAllNotes());
	} else {
		// No load in progress, start immediately
		loadingInProgress = loadAllNotes();
	}
}

sessionKeyManager.keyAvailable.subscribe((available) => {
	if (available && activeDb) {
		queueLoadAllNotes();
	}
});

/**
 * Setup database hooks for the active database
 * Should be called after setActiveDatabase
 */
export function setupDatabaseHooks(db: NotesDatabase) {
	db.notes.hook('creating', () => {
		queueLoadAllNotes();
	});

	db.notes.hook('updating', (modifications, primKey) => {
		// Note updated - just update that specific note in the list instead of reloading everything
		// This prevents flickering when switching between notes
		void updateSingleNote(primKey as string);
	});

	db.notes.hook('deleting', () => {
		queueLoadAllNotes();
	});
}

/**
 * Store for the currently selected note ID
 */
export const selectedNoteId = writable<string | null>(null);

/**
 * Store for folder tree structure
 * Uses liveQuery to load from settings table
 */
export const folders = liveQuery(async () => {
	if (!activeDb) {
		return {
			folders: [],
			version: 1
		} as FolderTree;
	}

	const folderSettings = await activeDb.settings.get('folders');
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
	if (!activeDb) {
		// Silently return null - vault is being closed/locked
		return null;
	}

	const key = sessionKeyManager.getKey();
	if (!key) {
		// Silently return null - vault is being closed/locked
		return null;
	}

	const encryptedNote = await activeDb.notes.get(noteId);
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
	if (!activeDb) {
		// Silently ignore - vault is being closed/locked
		return;
	}

	await activeDb.settings.put({
		id: 'folders',
		data: tree
	});
}

/**
 * Get the active database instance
 */
export function getActiveDatabase(): NotesDatabase | null {
	return activeDb;
}

