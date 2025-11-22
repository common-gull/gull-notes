<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Separator } from '$lib/components/ui/separator';
	import {
		Bold,
		Italic,
		Code,
		Heading1,
		Heading2,
		List,
		ListOrdered,
		Quote,
		Undo,
		Redo
	} from 'lucide-svelte';
	import type { Editor } from '@tiptap/core';

	interface Props {
		editor: Editor | null;
	}

	let { editor }: Props = $props();
</script>

{#if editor}
	<div class="flex flex-wrap items-center gap-1 border-b bg-background px-4 py-2">
		<Button
			variant="ghost"
			size="sm"
			onclick={() => editor.chain().focus().toggleBold().run()}
			class={editor.isActive('bold') ? 'bg-accent' : ''}
			disabled={!editor.can().chain().focus().toggleBold().run()}
		>
			<Bold class="h-4 w-4" />
		</Button>

		<Button
			variant="ghost"
			size="sm"
			onclick={() => editor.chain().focus().toggleItalic().run()}
			class={editor.isActive('italic') ? 'bg-accent' : ''}
			disabled={!editor.can().chain().focus().toggleItalic().run()}
		>
			<Italic class="h-4 w-4" />
		</Button>

		<Button
			variant="ghost"
			size="sm"
			onclick={() => editor.chain().focus().toggleCode().run()}
			class={editor.isActive('code') ? 'bg-accent' : ''}
			disabled={!editor.can().chain().focus().toggleCode().run()}
		>
			<Code class="h-4 w-4" />
		</Button>

		<Separator orientation="vertical" class="mx-1 h-6" />

		<Button
			variant="ghost"
			size="sm"
			onclick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
			class={editor.isActive('heading', { level: 1 }) ? 'bg-accent' : ''}
		>
			<Heading1 class="h-4 w-4" />
		</Button>

		<Button
			variant="ghost"
			size="sm"
			onclick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
			class={editor.isActive('heading', { level: 2 }) ? 'bg-accent' : ''}
		>
			<Heading2 class="h-4 w-4" />
		</Button>

		<Separator orientation="vertical" class="mx-1 h-6" />

		<Button
			variant="ghost"
			size="sm"
			onclick={() => editor.chain().focus().toggleBulletList().run()}
			class={editor.isActive('bulletList') ? 'bg-accent' : ''}
		>
			<List class="h-4 w-4" />
		</Button>

		<Button
			variant="ghost"
			size="sm"
			onclick={() => editor.chain().focus().toggleOrderedList().run()}
			class={editor.isActive('orderedList') ? 'bg-accent' : ''}
		>
			<ListOrdered class="h-4 w-4" />
		</Button>

		<Button
			variant="ghost"
			size="sm"
			onclick={() => editor.chain().focus().toggleBlockquote().run()}
			class={editor.isActive('blockquote') ? 'bg-accent' : ''}
		>
			<Quote class="h-4 w-4" />
		</Button>

		<Separator orientation="vertical" class="mx-1 h-6" />

		<Button
			variant="ghost"
			size="sm"
			onclick={() => editor.chain().focus().undo().run()}
			disabled={!editor.can().chain().focus().undo().run()}
		>
			<Undo class="h-4 w-4" />
		</Button>

		<Button
			variant="ghost"
			size="sm"
			onclick={() => editor.chain().focus().redo().run()}
			disabled={!editor.can().chain().focus().redo().run()}
		>
			<Redo class="h-4 w-4" />
		</Button>
	</div>
{/if}
