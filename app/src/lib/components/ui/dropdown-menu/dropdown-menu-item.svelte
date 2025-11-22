<script lang="ts">
	import { DropdownMenu as DropdownMenuPrimitive } from 'bits-ui';
	import { cn, type WithoutChildrenOrChild } from '$lib/utils.js';
	import type { Snippet } from 'svelte';

	type Props = WithoutChildrenOrChild<DropdownMenuPrimitive.ItemProps> & {
		inset?: boolean;
		children?: Snippet;
	};

	let {
		ref = $bindable(null),
		class: className,
		inset = false,
		children,
		...restProps
	}: Props = $props();
</script>

<DropdownMenuPrimitive.Item
	bind:ref
	class={cn(
		'relative flex cursor-default items-center rounded-sm px-2 py-1.5 text-sm transition-colors outline-none select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground',
		inset && 'pl-8',
		className
	)}
	{...restProps}
>
	{@render children?.()}
</DropdownMenuPrimitive.Item>
