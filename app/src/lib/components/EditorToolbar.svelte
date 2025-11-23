<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Separator } from '$lib/components/ui/separator';
	import LinkDialog from './LinkDialog.svelte';
	import {
		Bold,
		Italic,
		Code,
		Strikethrough,
		Underline,
		Link,
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

	let showLinkDialog = $state(false);
	let currentLinkUrl = $state('');

	function openLinkDialog() {
		if (!editor) return;
		currentLinkUrl = editor.getAttributes('link').href || '';
		showLinkDialog = true;
	}

	function handleLinkSubmit(url: string) {
		if (!editor) return;
		editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
	}

	function handleLinkRemove() {
		if (!editor) return;
		editor.chain().focus().extendMarkRange('link').unsetLink().run();
	}
</script>

{#if editor}
	<div class="flex items-center gap-1 overflow-x-auto border-b bg-background px-4 py-2">
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
			onclick={() => editor.chain().focus().toggleStrike().run()}
			class={editor.isActive('strike') ? 'bg-accent' : ''}
			disabled={!editor.can().chain().focus().toggleStrike().run()}
		>
			<Strikethrough class="h-4 w-4" />
		</Button>

		<Button
			variant="ghost"
			size="sm"
			onclick={() => editor.chain().focus().toggleUnderline().run()}
			class={editor.isActive('underline') ? 'bg-accent' : ''}
			disabled={!editor.can().chain().focus().toggleUnderline().run()}
		>
			<Underline class="h-4 w-4" />
		</Button>

		<Button
			variant="ghost"
			size="sm"
			onclick={openLinkDialog}
			class={editor.isActive('link') ? 'bg-accent' : ''}
		>
			<Link class="h-4 w-4" />
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

	<LinkDialog
		bind:open={showLinkDialog}
		initialUrl={currentLinkUrl}
		onClose={() => (showLinkDialog = false)}
		onSubmit={handleLinkSubmit}
		onRemove={handleLinkRemove}
	/>
{/if}
