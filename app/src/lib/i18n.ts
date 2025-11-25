import i18next from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { writable, derived } from 'svelte/store';
import en from './locales/en.json';

i18next.use(LanguageDetector).init({
	resources: {
		en: { translation: en }
	},
	fallbackLng: 'en',
	detection: {
		order: ['localStorage', 'navigator'],
		caches: ['localStorage']
	}
});

// Create a store to track language changes
const currentLanguage = writable(i18next.language);

// Update store when language changes
i18next.on('languageChanged', (lng) => {
	currentLanguage.set(lng);
});

// Reactive translation function
export const t = derived(currentLanguage, () => {
	return (key: string, options?: Record<string, unknown>): string => {
		return i18next.t(key, options);
	};
});

// Helper to get translation synchronously (for non-reactive contexts)
export function translate(key: string, options?: Record<string, unknown>): string {
	return i18next.t(key, options);
}

// Change language
export function setLanguage(lng: string): Promise<void> {
	return new Promise((resolve) => {
		i18next.changeLanguage(lng, () => resolve());
	});
}

// Get current language
export function getLanguage(): string {
	return i18next.language;
}

export default i18next;
