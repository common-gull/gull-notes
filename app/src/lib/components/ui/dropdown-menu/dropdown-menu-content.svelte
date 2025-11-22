<script lang="ts">
	import { DropdownMenu as DropdownMenuPrimitive } from 'bits-ui';
	import { cn, type WithoutChildrenOrChild } from '$lib/utils.js';
	import type { Snippet } from 'svelte';

	type Props = WithoutChildrenOrChild<DropdownMenuPrimitive.ContentProps> & {
		sideOffset?: number;
		children?: Snippet;
	};

	let {
		ref = $bindable(null),
		class: className,
		sideOffset = 4,
		children,
		...restProps
	}: Props = $props();
</script>

<DropdownMenuPrimitive.Portal>
	<DropdownMenuPrimitive.Content
		bind:ref
		{sideOffset}
		class={cn(
			'z-50 min-w-[8rem] rounded-md border bg-popover p-1 text-popover-foreground shadow-md outline-none data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
			className
		)}
		{...restProps}
	>
		{@render children?.()}
	</DropdownMenuPrimitive.Content>
</DropdownMenuPrimitive.Portal>
