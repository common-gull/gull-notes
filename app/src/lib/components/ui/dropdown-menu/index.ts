import { DropdownMenu as DropdownMenuPrimitive } from 'bits-ui';
import Content from './dropdown-menu-content.svelte';
import Item from './dropdown-menu-item.svelte';
import Separator from './dropdown-menu-separator.svelte';
import Trigger from './dropdown-menu-trigger.svelte';

const Root = DropdownMenuPrimitive.Root;
const Group = DropdownMenuPrimitive.Group;
const Portal = DropdownMenuPrimitive.Portal;

export {
	Root,
	Content,
	Item,
	Separator,
	Trigger,
	Group,
	Portal,
	//
	Root as DropdownMenu,
	Content as DropdownMenuContent,
	Item as DropdownMenuItem,
	Separator as DropdownMenuSeparator,
	Trigger as DropdownMenuTrigger,
	Group as DropdownMenuGroup,
	Portal as DropdownMenuPortal
};
