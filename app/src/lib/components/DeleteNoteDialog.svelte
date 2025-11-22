<script lang="ts">
	import Button from './ui/button/button.svelte';
	import { XIcon, AlertTriangleIcon } from 'lucide-svelte';

	interface Props {
		noteTitle: string;
		onConfirm: () => void | Promise<void>;
		onCancel: () => void;
	}

	let { noteTitle, onConfirm, onCancel }: Props = $props();

	let deleting = $state(false);

	async function handleConfirm() {
		if (deleting) return;

		deleting = true;
		try {
			await onConfirm();
		} catch (error) {
			console.error('Failed to delete note:', error);
			deleting = false;
		}
		// Note: We don't set deleting to false on success because the dialog will be closed
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape' && !deleting) {
			onCancel();
		} else if (e.key === 'Enter' && !deleting) {
			handleConfirm();
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<div
	class="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm"
>
	<div class="w-full max-w-md rounded-lg border border-border bg-card shadow-lg">
		<div class="flex items-center justify-between border-b border-border p-6">
			<h2 class="text-xl font-semibold">Delete Note</h2>
			<button
				onclick={onCancel}
				class="text-muted-foreground transition-colors hover:text-foreground"
				disabled={deleting}
				type="button"
			>
				<XIcon class="h-5 w-5" />
			</button>
		</div>

		<div class="space-y-4 p-6">
			<div class="flex items-start gap-3">
				<div class="flex-shrink-0 rounded-full bg-destructive/10 p-2">
					<AlertTriangleIcon class="h-5 w-5 text-destructive" />
				</div>
				<div class="flex-1 space-y-2">
					<p class="text-sm">Are you sure you want to delete this note?</p>
					<p class="text-sm font-semibold text-foreground">
						"{noteTitle}"
					</p>
					<p class="text-xs text-muted-foreground">
						This action cannot be undone. The note will be permanently deleted.
					</p>
				</div>
			</div>
		</div>

		<div class="flex items-center justify-end gap-3 border-t border-border p-6">
			<Button variant="outline" onclick={onCancel} disabled={deleting}>Cancel</Button>
			<Button variant="destructive" onclick={handleConfirm} disabled={deleting}>
				{#if deleting}
					<div class="inline-block h-4 w-4 animate-spin rounded-full border-b-2 border-white"></div>
					<span>Deleting...</span>
				{:else}
					Delete Note
				{/if}
			</Button>
		</div>
	</div>
</div>
