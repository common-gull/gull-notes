<script lang="ts">
	import { DropdownMenu as DropdownMenuPrimitive } from 'bits-ui';
	import type { Snippet } from 'svelte';

	type Props = DropdownMenuPrimitive.TriggerProps & {
		children?: Snippet;
	};

	let { ref = $bindable(null), class: className, children, ...restProps }: Props = $props();
</script>

<DropdownMenuPrimitive.Trigger bind:ref class={className} {...restProps}>
	{#if children}
		{@render children()}
	{/if}
</DropdownMenuPrimitive.Trigger>
