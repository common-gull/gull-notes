<script lang="ts">
	import { Button } from './ui/button';
	import { Input } from './ui/input';
	import { XIcon, PlusIcon } from 'lucide-svelte';
	import { allExistingTags } from '$lib/stores/notes';
	import { t } from '$lib/i18n';

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
			.filter((tag) => tag.toLowerCase().includes(query) && !currentTags.includes(tag))
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
		currentTags = currentTags.filter((tag) => tag !== tagToRemove);
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

<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
	<div class="w-full max-w-md rounded-lg border border-border bg-card shadow-lg">
		<div class="flex items-center justify-between border-b border-border p-6">
			<h2 class="text-xl font-bold">{$t('tags.manageTitle')}</h2>
			<button
				onclick={onClose}
				class="text-muted-foreground transition-colors hover:text-foreground"
			>
				<XIcon class="h-5 w-5" />
			</button>
		</div>

		<div class="space-y-4 p-6">
			<!-- Current tags display -->
			{#if currentTags.length > 0}
				<div class="mb-4 flex flex-wrap gap-2">
					{#each currentTags as tag (tag)}
						<span
							class="inline-flex items-center gap-1 rounded bg-secondary px-2 py-1 text-sm text-secondary-foreground"
						>
							{tag}
							<button
								onclick={() => removeTag(tag)}
								class="transition-colors hover:text-destructive"
								type="button"
							>
								<XIcon class="h-3 w-3" />
							</button>
						</span>
					{/each}
				</div>
			{/if}

			<!-- Tag input with autocomplete -->
			<div class="space-y-2">
				<label for="tag-input" class="text-sm font-medium">{$t('tags.addTag')}</label>
				<div class="relative">
					<div class="flex gap-2">
						<Input
							id="tag-input"
							bind:value={inputValue}
							onkeydown={handleInputKeydown}
							onfocus={handleInputFocus}
							onblur={handleInputBlur}
							placeholder={$t('tags.placeholder')}
							class="flex-1"
						/>
						<Button
							onclick={() => addTag(inputValue)}
							disabled={!inputValue.trim()}
							size="sm"
							type="button"
						>
							<PlusIcon class="h-4 w-4" />
						</Button>
					</div>

					<!-- Autocomplete dropdown -->
					{#if showAutocomplete && filteredSuggestions.length > 0}
						<div
							class="absolute z-10 mt-1 max-h-40 w-full overflow-y-auto rounded-md border border-border bg-popover shadow-lg"
						>
							{#each filteredSuggestions as suggestion (suggestion)}
								<button
									type="button"
									class="w-full px-3 py-2 text-left text-sm transition-colors hover:bg-accent"
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
					{$t('tags.hint')}
				</p>
			</div>
		</div>

		<!-- Footer with actions -->
		<div class="flex justify-end gap-2 border-t border-border p-6">
			<Button variant="outline" onclick={onClose}>{$t('common.cancel')}</Button>
			<Button onclick={handleSave}>{$t('tags.saveTags')}</Button>
		</div>
	</div>
</div>
