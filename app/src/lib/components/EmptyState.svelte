<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import FileText from '@lucide/svelte/icons/file-text';
	import Plus from '@lucide/svelte/icons/plus';
	import Loader2 from '@lucide/svelte/icons/loader-2';
	import { selectedNoteId, notesLoading, getActiveDatabase } from '$lib/stores/notes';
	import { encryptData, sessionKeyManager } from '$lib/services/encryption';
	import type { DecryptedMetadata, DecryptedContent } from '$lib/types';
	import { t } from '$lib/i18n';

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
			title: $t('notes.welcomeTitle'),
			tags: ['welcome'],
			color: undefined
		};

		const content: DecryptedContent = {
			body: `<h1>${$t('notes.welcomeTitle')}</h1><p>${$t('notes.welcomeBody')}</p>`
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
	<div class="flex h-full flex-col items-center justify-center p-8 text-center">
		<div class="mb-6 animate-pulse rounded-full bg-muted p-6">
			<Loader2 class="h-12 w-12 animate-spin text-muted-foreground" />
		</div>

		<h2 class="mb-2 text-2xl font-semibold">{$t('notes.loadingNotes')}</h2>
		<p class="mb-6 max-w-sm text-muted-foreground">
			{$t('notes.decryptingNotes')}
		</p>
	</div>
{:else}
	<!-- Empty state -->
	<div class="flex h-full flex-col items-center justify-center p-8 text-center">
		<div class="mb-6 rounded-full bg-muted p-6">
			<FileText class="h-12 w-12 text-muted-foreground" />
		</div>

		<h2 class="mb-2 text-2xl font-semibold">{$t('notes.noNotesYet')}</h2>
		<p class="mb-6 max-w-sm text-muted-foreground">
			{$t('notes.noNotesDescription')}
		</p>

		<Button size="lg" onclick={createFirstNote}>
			<Plus class="mr-2 h-5 w-5" />
			{$t('notes.createFirst')}
		</Button>
	</div>
{/if}
