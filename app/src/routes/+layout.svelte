<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { theme, getResolvedTheme, watchSystemTheme } from '$lib/stores/theme';
	import { browser } from '$app/environment';

	let { children } = $props();

	// Apply theme to document
	$effect(() => {
		if (!browser) return;

		const resolvedTheme = getResolvedTheme($theme);
		const html = document.documentElement;

		if (resolvedTheme === 'dark') {
			html.classList.add('dark');
		} else {
			html.classList.remove('dark');
		}

		// Watch for system theme changes if using system preference
		if ($theme === 'system') {
			const unwatch = watchSystemTheme((isDark) => {
				if (isDark) {
					html.classList.add('dark');
				} else {
					html.classList.remove('dark');
				}
			});
			return unwatch;
		}
	});
</script>

<svelte:head>
	<title>Gull Notes</title>
	<link rel="icon" href={favicon} />
</svelte:head>

{@render children()}
