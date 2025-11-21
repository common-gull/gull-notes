import Dexie, { type EntityTable } from 'dexie';
import type { EncryptedNote, AppSettings } from './types';

/**
 * Database class with typed tables
 */
class NotesDatabase extends Dexie {
	// Tables are declared as properties
	notes!: EntityTable<EncryptedNote, 'id'>;
	settings!: EntityTable<AppSettings, 'id'>;

	constructor() {
		super('SecureNotesDB');

		// Define schema
		this.version(1).stores({
			// Notes table: id is primary key (string UUID), indexed on createdAt and updatedAt
			notes: 'id, createdAt, updatedAt',
			// Settings table: generic key-value store
			settings: 'id'
		});
	}
}

// Export singleton instance
export const db = new NotesDatabase();

// Export type for use in other files
export type { NotesDatabase };

