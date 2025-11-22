<script lang="ts">
	import { Button } from './ui/button';
	import { Input } from './ui/input';
	import { XIcon, PlusIcon } from 'lucide-svelte';
	import { allExistingTags } from '$lib/stores/notes';

	interface Props {
		tags: string[];
		onSave: (tags: string[]) => void;
		onClose: () => void;
	}

	let { tags, onSave, onClose }: Props = $props();

	let currentTags = $state<string[]>([...tags]);
	let inputValue = $state('');
	let showAutocomplete = $state(false);

	// Filter existing tags based on input
	let filteredSuggestions = $derived.by(() => {
		if (!inputValue.trim()) return [];
		
		const query = inputValue.toLowerCase().trim();
		return $allExistingTags
			.filter(tag => 
				tag.toLowerCase().includes(query) && 
				!currentTags.includes(tag)
			)
			.slice(0, 5); // Limit to 5 suggestions
	});

	function addTag(tag: string) {
		const trimmedTag = tag.trim();
		if (trimmedTag && !currentTags.includes(trimmedTag)) {
			currentTags = [...currentTags, trimmedTag];
			inputValue = '';
			showAutocomplete = false;
		}
	}

	function removeTag(tagToRemove: string) {
		currentTags = currentTags.filter(tag => tag !== tagToRemove);
	}

	function handleInputKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault();
			if (filteredSuggestions.length > 0 && showAutocomplete) {
				// Add first suggestion
				addTag(filteredSuggestions[0]);
			} else if (inputValue.trim()) {
				// Add typed value
				addTag(inputValue);
			}
		} else if (e.key === 'Escape') {
			if (showAutocomplete) {
				showAutocomplete = false;
			} else {
				onClose();
			}
		}
	}

	function handleSave() {
		onSave(currentTags);
		onClose();
	}

	function handleInputFocus() {
		showAutocomplete = true;
	}

	function handleInputBlur() {
		// Delay to allow clicking on suggestions
		setTimeout(() => {
			showAutocomplete = false;
		}, 200);
	}
</script>

<div class="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
	<div class="w-full max-w-md bg-card border border-border rounded-lg shadow-lg">
		<div class="flex items-center justify-between p-6 border-b border-border">
			<h2 class="text-xl font-bold">Manage Tags</h2>
			<button
				onclick={onClose}
				class="text-muted-foreground hover:text-foreground transition-colors"
			>
				<XIcon class="w-5 h-5" />
			</button>
		</div>

		<div class="p-6 space-y-4">
			<!-- Current tags display -->
			{#if currentTags.length > 0}
				<div class="flex flex-wrap gap-2 mb-4">
					{#each currentTags as tag}
						<span class="inline-flex items-center gap-1 bg-secondary text-secondary-foreground px-2 py-1 rounded text-sm">
							{tag}
							<button
								onclick={() => removeTag(tag)}
								class="hover:text-destructive transition-colors"
								type="button"
							>
								<XIcon class="w-3 h-3" />
							</button>
						</span>
					{/each}
				</div>
			{/if}

			<!-- Tag input with autocomplete -->
			<div class="space-y-2">
				<label for="tag-input" class="text-sm font-medium">Add Tag</label>
				<div class="relative">
					<div class="flex gap-2">
						<Input
							id="tag-input"
							bind:value={inputValue}
							onkeydown={handleInputKeydown}
							onfocus={handleInputFocus}
							onblur={handleInputBlur}
							placeholder="Type a tag name..."
							class="flex-1"
						/>
						<Button
							onclick={() => addTag(inputValue)}
							disabled={!inputValue.trim()}
							size="sm"
							type="button"
						>
							<PlusIcon class="w-4 h-4" />
						</Button>
					</div>
					
					<!-- Autocomplete dropdown -->
					{#if showAutocomplete && filteredSuggestions.length > 0}
						<div class="absolute z-10 w-full mt-1 bg-popover border border-border rounded-md shadow-lg max-h-40 overflow-y-auto">
							{#each filteredSuggestions as suggestion}
								<button
									type="button"
									class="w-full text-left px-3 py-2 hover:bg-accent transition-colors text-sm"
									onmousedown={(e) => {
										e.preventDefault();
										addTag(suggestion);
									}}
								>
									{suggestion}
								</button>
							{/each}
						</div>
					{/if}
				</div>
				<p class="text-xs text-muted-foreground">
					Press Enter to add a tag or select from suggestions
				</p>
			</div>
		</div>

		<!-- Footer with actions -->
		<div class="flex justify-end gap-2 p-6 border-t border-border">
			<Button variant="outline" onclick={onClose}>
				Cancel
			</Button>
			<Button onclick={handleSave}>
				Save Tags
			</Button>
		</div>
	</div>
</div>

