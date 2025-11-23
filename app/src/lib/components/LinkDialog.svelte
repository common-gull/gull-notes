<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import * as Dialog from '$lib/components/ui/dialog';

	interface Props {
		open: boolean;
		initialUrl?: string;
		onClose: () => void;
		onSubmit: (url: string) => void;
		onRemove?: () => void;
	}

	let { open = $bindable(), initialUrl = '', onClose, onSubmit, onRemove }: Props = $props();

	let url = $state(initialUrl);

	// Update url when initialUrl changes (when dialog opens)
	$effect(() => {
		if (open) {
			url = initialUrl || '';
		}
	});

	function handleSubmit(e: Event) {
		e.preventDefault();
		if (url.trim()) {
			onSubmit(url.trim());
			onClose();
		}
	}

	function handleRemove() {
		if (onRemove) {
			onRemove();
			onClose();
		}
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Portal>
		<Dialog.Overlay />
		<Dialog.Content class="sm:max-w-[425px]">
			<Dialog.Header>
				<Dialog.Title>{initialUrl ? 'Edit Link' : 'Add Link'}</Dialog.Title>
				<Dialog.Description>
					{initialUrl ? 'Update the URL for this link.' : 'Enter a URL to create a hyperlink.'}
				</Dialog.Description>
			</Dialog.Header>
			<form onsubmit={handleSubmit}>
				<div class="grid gap-4 py-4">
					<div class="grid gap-2">
						<label for="url" class="text-sm font-medium">URL</label>
						<Input
							id="url"
							type="url"
							placeholder="https://example.com"
							bind:value={url}
							autofocus
						/>
					</div>
				</div>
				<Dialog.Footer class="gap-2">
					{#if initialUrl && onRemove}
						<Button type="button" variant="destructive" onclick={handleRemove}>Remove Link</Button>
					{/if}
					<Button type="button" variant="outline" onclick={onClose}>Cancel</Button>
					<Button type="submit" disabled={!url.trim()}>
						{initialUrl ? 'Update' : 'Add'} Link
					</Button>
				</Dialog.Footer>
			</form>
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>
