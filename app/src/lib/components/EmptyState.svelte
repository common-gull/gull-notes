<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { FileText, Plus, Loader2 } from 'lucide-svelte';
	import { selectedNoteId, notesLoading, getActiveDatabase } from '$lib/stores/notes';
	import { encryptData, sessionKeyManager } from '$lib/services/encryption';
	import type { DecryptedMetadata, DecryptedContent } from '$lib/types';

	async function createFirstNote() {
		const db = getActiveDatabase();
		if (!db) {
			console.error('No active database');
			return;
		}

		const key = sessionKeyManager.getKey();
		if (!key) {
			console.error('No encryption key available');
			return;
		}

		const now = Date.now();
		const noteId = crypto.randomUUID();

		const metadata: DecryptedMetadata = {
			title: 'My First Note',
			tags: ['welcome'],
			color: undefined
		};

		const content: DecryptedContent = {
			body: '<h1>Welcome to Gull Notes!</h1><p>Start writing your thoughts securely.</p>'
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
</script>

{#if $notesLoading}
	<!-- Loading state -->
	<div class="flex flex-col items-center justify-center h-full text-center p-8">
		<div class="rounded-full bg-muted p-6 mb-6 animate-pulse">
			<Loader2 class="h-12 w-12 text-muted-foreground animate-spin" />
		</div>

		<h2 class="text-2xl font-semibold mb-2">Loading notes...</h2>
		<p class="text-muted-foreground mb-6 max-w-sm">
			Decrypting your notes securely. This may take a moment.
		</p>
	</div>
{:else}
	<!-- Empty state -->
	<div class="flex flex-col items-center justify-center h-full text-center p-8">
		<div class="rounded-full bg-muted p-6 mb-6">
			<FileText class="h-12 w-12 text-muted-foreground" />
		</div>

		<h2 class="text-2xl font-semibold mb-2">No notes yet</h2>
		<p class="text-muted-foreground mb-6 max-w-sm">
			Start your secure note-taking journey by creating your first note. Your data is encrypted and
			stored locally.
		</p>

		<Button size="lg" onclick={createFirstNote}>
			<Plus class="h-5 w-5 mr-2" />
			Create Your First Note
		</Button>
	</div>
{/if}

