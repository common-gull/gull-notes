import Dexie, { type EntityTable } from 'dexie';
import type { EncryptedNote, AppSettings } from './types';

/**
 * Database class with typed tables
 */
export class NotesDatabase extends Dexie {
	// Tables are declared as properties
	notes!: EntityTable<EncryptedNote, 'id'>;
	settings!: EntityTable<AppSettings, 'id'>;

	constructor(vaultName: string) {
		super(vaultName);

		// Define schema
		this.version(1).stores({
			// Notes table: id is primary key (string UUID), indexed on createdAt and updatedAt
			notes: 'id, createdAt, updatedAt',
			// Settings table: generic key-value store
			settings: 'id'
		});
	}
}

/**
 * Open a database for a specific vault
 * @param vaultName The name of the vault database (e.g., 'vault_{uuid}')
 * @returns NotesDatabase instance
 */
export function openDatabase(vaultName: string): NotesDatabase {
	return new NotesDatabase(vaultName);
}

// Keep backward compatibility with a default instance for migration
// This will be replaced by the vault system
export const db = new NotesDatabase('SecureNotesDB');

