// Type definitions for the secure note-taking app
// Based on ENCRYPTION_STRATEGY.md

/**
 * EncryptedNote as stored in IndexedDB
 * Matches the schema from ENCRYPTION_STRATEGY.md
 */
export interface EncryptedNote {
	id: string; // UUID (plaintext, required for indexing)

	// 1. LIGHTWEIGHT METADATA (Encrypted separately)
	// Contains: { title: string, tags: string[], color: string }
	// Purpose: Fast decryption for list views & search
	metaCipher: ArrayBuffer;
	metaIv: Uint8Array;

	// 2. HEAVY CONTENT (Encrypted separately)
	// Contains: Full markdown body, attachments, history
	// Purpose: Decrypted only when viewing the specific note
	contentCipher: ArrayBuffer;
	contentIv: Uint8Array;

	// 3. PLAINTEXT METADATA (Non-sensitive)
	createdAt: number; // For sorting
	updatedAt: number; // For syncing
	schemaVersion: number;
}

/**
 * Decrypted metadata for in-memory search index
 */
export interface DecryptedMetadata {
	title: string;
	tags: string[];
	color?: string;
}

/**
 * Decrypted note content
 */
export interface DecryptedContent {
	body: string; // Markdown content
	attachments?: string[]; // Future: attachment IDs
}

/**
 * Full note with decrypted data (for in-memory use only)
 */
export interface Note {
	id: string;
	metadata: DecryptedMetadata;
	content: DecryptedContent;
	createdAt: number;
	updatedAt: number;
	folderId?: string; // Optional folder assignment
}

/**
 * Folder structure with nested children support
 */
export interface Folder {
	id: string;
	name: string;
	parentId?: string; // null/undefined for root folders
	children?: Folder[];
	expanded?: boolean; // UI state
	createdAt: number;
}

/**
 * App settings stored in IndexedDB
 */
export interface AppSettings {
	id: string; // 'folders' | 'preferences' | etc.
	data: unknown; // JSON serializable data
}

/**
 * Folder tree structure stored in settings
 */
export interface FolderTree {
	folders: Folder[];
	version: number;
}

/**
 * Vault metadata stored in each vault's settings
 */
export interface VaultMetadata {
	name: string;
	createdAt: number;
}

/**
 * Vault information for listing/selection
 */
export interface VaultInfo {
	id: string; // Database name (vault_{uuid})
	name: string;
	createdAt: number;
}

/**
 * Encrypted data key storage format
 */
export interface EncryptedKeyData {
	encryptedKey: ArrayBuffer;
	keyIv: Uint8Array;
	salt: Uint8Array;
}
