import { Extension } from '@tiptap/core';
import { Plugin } from '@tiptap/pm/state';
import type { Editor } from '@tiptap/core';

// Helper function to detect if text looks like Markdown
function looksLikeMarkdown(text: string): boolean {
	// Simple heuristic: check for Markdown syntax
	return (
		/^#{1,6}\s/m.test(text) || // Headings
		/\*\*[^*]+\*\*/.test(text) || // Bold
		/\*[^*]+\*/.test(text) || // Italic
		/\[.+?\]\(.+?\)/.test(text) || // Links
		/^[-*+]\s/m.test(text) || // Unordered lists
		/^\d+\.\s/m.test(text) || // Ordered lists
		/^>\s/m.test(text) || // Blockquotes
		/`[^`]+`/.test(text) || // Inline code
		/```[\s\S]*?```/.test(text) || // Code blocks
		/~~[^~]+~~/.test(text) // Strikethrough
	);
}

// Helper function to HTML-escape text to prevent XSS
function escapeHtml(text: string): string {
	return text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#039;');
}

// Helper function to validate and sanitize URLs
function sanitizeUrl(url: string): string {
	const trimmed = url.trim();
	// Allow only safe protocols
	if (
		trimmed.startsWith('http://') ||
		trimmed.startsWith('https://') ||
		trimmed.startsWith('mailto:')
	) {
		return trimmed;
	}
	// Default to https if no protocol specified and looks like a URL
	if (/^[a-zA-Z0-9]/.test(trimmed) && trimmed.includes('.')) {
		return `https://${trimmed}`;
	}
	// Return empty href for unsafe URLs
	return '';
}

// Helper function to process inline markdown formatting
function processInlineMarkdown(text: string, inlineCodes: string[]): string {
	return (
		text
			// Bold (must come before italic to handle ** correctly)
			.replace(/\*\*(.+?)\*\*/g, (match, content) => `<strong>${escapeHtml(content)}</strong>`)
			.replace(/__(.+?)__/g, (match, content) => `<strong>${escapeHtml(content)}</strong>`)
			// Italic
			.replace(/\*(.+?)\*/g, (match, content) => `<em>${escapeHtml(content)}</em>`)
			.replace(/_(.+?)_/g, (match, content) => `<em>${escapeHtml(content)}</em>`)
			// Strikethrough
			.replace(/~~(.+?)~~/g, (match, content) => `<s>${escapeHtml(content)}</s>`)
			// Links
			.replace(/\[(.+?)\]\((.+?)\)/g, (match, linkText, url) => {
				const safeUrl = sanitizeUrl(url);
				if (!safeUrl) return escapeHtml(linkText); // If URL is unsafe, just return the text
				return `<a href="${escapeHtml(safeUrl)}">${escapeHtml(linkText)}</a>`;
			})
			// Restore inline code
			.replace(/§§§INLINECODE(\d+)§§§/g, (match, index) => {
				return `<code>${escapeHtml(inlineCodes[parseInt(index)])}</code>`;
			})
	);
}

interface PasteMarkdownOptions {
	getEditor: () => Editor | null;
}

// Create PasteMarkdown extension
// Note: TipTap's Markdown extension is for serialization (export), not parsing
// This is a simplified version that handles basic markdown conversion
export const PasteMarkdown = Extension.create<PasteMarkdownOptions>({
	name: 'pasteMarkdown',

	addOptions() {
		return {
			getEditor: () => null
		};
	},

	addProseMirrorPlugins() {
		return [
			new Plugin({
				props: {
					handlePaste: (view, event) => {
						const text = event.clipboardData?.getData('text/plain');

						if (!text || !text.trim()) {
							return false;
						}

						// Check if text looks like Markdown
						if (looksLikeMarkdown(text)) {
							const editor = this.options.getEditor();
							if (!editor) return false;

							event.preventDefault();

							// Store code blocks temporarily to prevent them from being processed
							const codeBlocks: Array<{ language: string; code: string }> = [];
							let textWithPlaceholders = text.replace(
								/```(\w+)?\s*\n([\s\S]*?)\n```/g,
								(match, language, code) => {
									const index = codeBlocks.length;
									codeBlocks.push({
										language: language || '',
										code: code
									});
									return `§§§CODEBLOCK${index}§§§`;
								}
							);

							// Store inline code temporarily
							const inlineCodes: string[] = [];
							textWithPlaceholders = textWithPlaceholders.replace(/`([^`]+)`/g, (match, code) => {
								const index = inlineCodes.length;
								inlineCodes.push(code);
								return `§§§INLINECODE${index}§§§`;
							});

							// Simple markdown to HTML conversion for common patterns
							const html = textWithPlaceholders
								// Convert newlines to paragraphs FIRST (before restoring code blocks)
								.split('\n\n')
								.map((para) => {
									if (!para.trim()) return '';

									// Check if this is an unordered list (all non-empty lines start with -, *, or +)
									const lines = para.split('\n').filter((line) => line.trim());
									if (lines.length > 0 && lines.every((line) => /^[-*+]\s/.test(line.trim()))) {
										const listItems = lines
											.map((line) => {
												const content = line.replace(/^[-*+]\s+/, '');
												const processed = processInlineMarkdown(content, inlineCodes);
												return `<li><p>${processed}</p></li>`;
											})
											.join('');
										return `<ul>${listItems}</ul>`;
									}

									// Check if this is an ordered list (all non-empty lines start with number.)
									if (lines.length > 0 && lines.every((line) => /^\d+\.\s/.test(line.trim()))) {
										const listItems = lines
											.map((line) => {
												const content = line.replace(/^\d+\.\s+/, '');
												const processed = processInlineMarkdown(content, inlineCodes);
												return `<li><p>${processed}</p></li>`;
											})
											.join('');
										return `<ol>${listItems}</ol>`;
									}

									// Check if this is a blockquote (all non-empty lines start with >)
									if (lines.length > 0 && lines.every((line) => line.trim().startsWith('>'))) {
										const quoteContent = lines
											.map((line) => line.replace(/^>\s?/, ''))
											.join('<br>');
										const processed = processInlineMarkdown(quoteContent, inlineCodes);
										return `<blockquote><p>${processed}</p></blockquote>`;
									}

									// Process markdown within this paragraph
									let processed = para
										// Headers (must escape content)
										.replace(
											/^#{6}\s+(.+)$/gm,
											(match, content) => `<h6>${escapeHtml(content)}</h6>`
										)
										.replace(
											/^#{5}\s+(.+)$/gm,
											(match, content) => `<h5>${escapeHtml(content)}</h5>`
										)
										.replace(
											/^#{4}\s+(.+)$/gm,
											(match, content) => `<h4>${escapeHtml(content)}</h4>`
										)
										.replace(
											/^#{3}\s+(.+)$/gm,
											(match, content) => `<h3>${escapeHtml(content)}</h3>`
										)
										.replace(
											/^#{2}\s+(.+)$/gm,
											(match, content) => `<h2>${escapeHtml(content)}</h2>`
										)
										.replace(
											/^#{1}\s+(.+)$/gm,
											(match, content) => `<h1>${escapeHtml(content)}</h1>`
										);

									// Apply inline markdown formatting
									processed = processInlineMarkdown(processed, inlineCodes);

									// Restore code blocks
									processed = processed.replace(/§§§CODEBLOCK(\d+)§§§/g, (match, index) => {
										const block = codeBlocks[parseInt(index)];
										const langAttr = block.language
											? ` class="language-${escapeHtml(block.language)}"`
											: '';
										return `<pre><code${langAttr}>${escapeHtml(block.code)}</code></pre>`;
									});

									// Check if it's already wrapped in a block tag
									if (/^<h[1-6]>/.test(processed) || /^<(ul|ol|blockquote|pre)>/.test(processed)) {
										return processed;
									}
									return `<p>${processed.replace(/\n/g, '<br>')}</p>`;
								})
								.join('');

							editor.commands.insertContent(html);
							return true;
						}

						return false;
					}
				}
			})
		];
	}
});
