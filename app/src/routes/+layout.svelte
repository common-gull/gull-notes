<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { theme, getResolvedTheme, watchSystemTheme } from '$lib/stores/theme';
	import { browser } from '$app/environment';
	import { Toaster } from '$lib/components/ui/sonner';
	import { t } from '$lib/i18n';

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
	<title>{$t('common.appName')}</title>
	<link rel="icon" href={favicon} />
</svelte:head>

<Toaster />

{@render children()}
