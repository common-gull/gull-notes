import { writable } from 'svelte/store';
import { browser } from '$app/environment';

type Theme = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'theme-preference';

function getInitialTheme(): Theme {
	if (!browser) return 'system';

	const stored = localStorage.getItem(STORAGE_KEY);
	if (stored === 'light' || stored === 'dark' || stored === 'system') {
		return stored;
	}
	return 'system';
}

function getSystemTheme(): 'light' | 'dark' {
	if (!browser) return 'light';
	return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function createThemeStore() {
	const { subscribe, set, update } = writable<Theme>(getInitialTheme());

	return {
		subscribe,
		set: (value: Theme) => {
			if (browser) {
				localStorage.setItem(STORAGE_KEY, value);
			}
			set(value);
		},
		toggle: () => {
			update((current) => {
				const resolved = current === 'system' ? getSystemTheme() : current;
				const next = resolved === 'dark' ? 'light' : 'dark';
				if (browser) {
					localStorage.setItem(STORAGE_KEY, next);
				}
				return next;
			});
		}
	};
}

export const theme = createThemeStore();

/**
 * Get the resolved theme (light or dark) based on current preference
 */
export function getResolvedTheme(currentTheme: Theme): 'light' | 'dark' {
	if (currentTheme === 'system') {
		return getSystemTheme();
	}
	return currentTheme;
}

/**
 * Listen to system theme changes
 */
export function watchSystemTheme(callback: (isDark: boolean) => void) {
	if (!browser) return () => {};

	const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
	const handler = (e: MediaQueryListEvent) => callback(e.matches);

	mediaQuery.addEventListener('change', handler);
	return () => mediaQuery.removeEventListener('change', handler);
}
