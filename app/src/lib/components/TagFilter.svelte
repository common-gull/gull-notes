<script lang="ts">
	import { Button } from './ui/button';
	import { ScrollArea } from './ui/scroll-area';
	import { FilterIcon } from 'lucide-svelte';
	import { allExistingTags, selectedTagFilter, notesWithMetadata } from '$lib/stores/notes';

	let showDropdown = $state(false);

	// Get count of notes per tag
	function getTagCount(tag: string): number {
		return $notesWithMetadata.filter((note) =>
			note.metadata.tags.some((t) => t.toLowerCase() === tag.toLowerCase())
		).length;
	}

	function toggleTag(tag: string) {
		selectedTagFilter.update((tags) => {
			// Create a new Set from the existing tags
			const tagsArray = Array.from(tags);
			const lowerTag = tag.toLowerCase();

			// Check if tag already exists (case-insensitive)
			const existingTag = tagsArray.find((t) => t.toLowerCase() === lowerTag);

			if (existingTag) {
				// Remove the tag
				return new Set(tagsArray.filter((t) => t !== existingTag));
			} else {
				// Add the tag
				return new Set([...tagsArray, tag]);
			}
		});
	}

	function isTagSelected(tag: string): boolean {
		return Array.from($selectedTagFilter).some((t) => t.toLowerCase() === tag.toLowerCase());
	}

	function clearAllFilters() {
		selectedTagFilter.set(new Set());
	}

	// Close dropdown when clicking outside
	function handleClickOutside(event: MouseEvent) {
		const target = event.target as HTMLElement;
		if (!target.closest('.tag-filter-container')) {
			showDropdown = false;
		}
	}

	$effect(() => {
		if (showDropdown) {
			document.addEventListener('click', handleClickOutside);
			return () => {
				document.removeEventListener('click', handleClickOutside);
			};
		}
	});
</script>

<div class="tag-filter-container relative">
	<Button
		variant="outline"
		size="sm"
		onclick={() => (showDropdown = !showDropdown)}
		class="w-full justify-start gap-2"
	>
		<FilterIcon class="h-4 w-4" />
		<span class="flex-1 text-left">Filter by Tags</span>
		{#if $selectedTagFilter.size > 0}
			<span
				class="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground"
			>
				{$selectedTagFilter.size}
			</span>
		{/if}
	</Button>

	{#if showDropdown}
		<div
			class="absolute top-full z-50 mt-1 w-full rounded-md border border-border bg-popover shadow-lg"
		>
			{#if $allExistingTags.length === 0}
				<div class="p-4 text-center text-sm text-muted-foreground">No tags available</div>
			{:else}
				<div class="flex items-center justify-between border-b border-border p-2">
					<span class="text-sm font-medium">Select Tags</span>
					{#if $selectedTagFilter.size > 0}
						<Button variant="ghost" size="sm" onclick={clearAllFilters} class="h-7 text-xs">
							Clear All
						</Button>
					{/if}
				</div>
				<ScrollArea class="max-h-60">
					<div class="p-2">
						{#each $allExistingTags as tag (tag)}
							<button
								type="button"
								class="flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent"
								onclick={() => toggleTag(tag)}
							>
								<div class="flex items-center gap-2">
									<input
										type="checkbox"
										checked={isTagSelected(tag)}
										class="h-4 w-4 rounded border-input"
										readonly
									/>
									<span>{tag}</span>
								</div>
								<span class="text-xs text-muted-foreground">
									{getTagCount(tag)}
								</span>
							</button>
						{/each}
					</div>
				</ScrollArea>
			{/if}
		</div>
	{/if}
</div>
