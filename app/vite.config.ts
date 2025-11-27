import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';
import { sveltekit } from '@sveltejs/kit/vite';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	build: {
		chunkSizeWarningLimit: 550,
		rollupOptions: {
			output: {
				manualChunks: (id) => {
					// ProseMirror view (rendering) - largest part
					if (id.includes('prosemirror-view')) {
						return 'pm-view';
					}
					// ProseMirror model (document structure)
					if (id.includes('prosemirror-model')) {
						return 'pm-model';
					}
					// Other ProseMirror packages
					if (id.includes('prosemirror')) {
						return 'pm-other';
					}
					// TipTap core
					if (id.includes('@tiptap/core') || id.includes('@tiptap/pm')) {
						return 'tiptap-core';
					}
					// TipTap extensions
					if (id.includes('@tiptap/extension') || id.includes('@tiptap/starter-kit')) {
						return 'tiptap-ext';
					}
					// TipTap markdown
					if (id.includes('@tiptap/markdown')) {
						return 'tiptap-md';
					}
					// Syntax highlighting into its own chunk
					if (id.includes('highlight.js') || id.includes('lowlight')) {
						return 'highlight';
					}
					// Database layer into its own chunk
					if (id.includes('dexie')) {
						return 'db';
					}
				}
			}
		}
	},
	test: {
		expect: { requireAssertions: true },
		projects: [
			{
				extends: './vite.config.ts',
				test: {
					name: 'client',
					browser: {
						enabled: true,
						provider: playwright(),
						instances: [{ browser: 'chromium', headless: true }]
					},
					include: ['src/**/*.svelte.{test,spec}.{js,ts}'],
					exclude: ['src/lib/server/**']
				}
			},
			{
				extends: './vite.config.ts',
				test: {
					name: 'server',
					environment: 'node',
					include: ['src/**/*.{test,spec}.{js,ts}'],
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}']
				}
			}
		]
	}
});
