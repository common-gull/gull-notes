<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { ExternalLink, Pencil, Trash2 } from 'lucide-svelte';

	interface Props {
		open: boolean;
		url: string;
		position: { x: number; y: number };
		onClose: () => void;
		onEdit: () => void;
		onRemove: () => void;
	}

	let { open = $bindable(), url, position, onClose, onEdit, onRemove }: Props = $props();

	function handleVisit() {
		window.open(url, '_blank', 'noopener,noreferrer');
		onClose();
	}

	function handleEdit() {
		onEdit();
		onClose();
	}

	function handleRemove() {
		onRemove();
		onClose();
	}

	// Handle Escape key to close menu
	$effect(() => {
		if (open) {
			const handleKeyDown = (e: KeyboardEvent) => {
				if (e.key === 'Escape') {
					onClose();
				}
			};
			window.addEventListener('keydown', handleKeyDown);
			return () => {
				window.removeEventListener('keydown', handleKeyDown);
			};
		}
	});
</script>

{#if open}
	<div
		class="fixed z-50 rounded-md border bg-popover p-1 shadow-md"
		style="left: {position.x}px; top: {position.y}px;"
		role="menu"
	>
		<div class="flex flex-col gap-1">
			<Button variant="ghost" size="sm" class="justify-start gap-2" onclick={handleVisit}>
				<ExternalLink class="h-4 w-4" />
				<span class="flex-1 text-left">Visit Link</span>
			</Button>

			<Button variant="ghost" size="sm" class="justify-start gap-2" onclick={handleEdit}>
				<Pencil class="h-4 w-4" />
				<span class="flex-1 text-left">Edit Link</span>
			</Button>

			<Button
				variant="ghost"
				size="sm"
				class="hover:text-destructive-foreground justify-start gap-2 text-destructive hover:bg-destructive"
				onclick={handleRemove}
			>
				<Trash2 class="h-4 w-4" />
				<span class="flex-1 text-left">Remove Link</span>
			</Button>
		</div>
	</div>

	<!-- Overlay to close menu when clicking outside -->
	<div class="fixed inset-0 z-40" onclick={onClose} aria-hidden="true"></div>
{/if}
