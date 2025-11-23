import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { PasteMarkdown } from './paste-markdown';

describe('PasteMarkdown Extension', () => {
	let editor: Editor;
	let container: HTMLDivElement;

	beforeEach(() => {
		// Create a test editor instance
		container = document.createElement('div');
		document.body.appendChild(container);

		editor = new Editor({
			element: container,
			extensions: [
				StarterKit,
				PasteMarkdown.configure({
					getEditor: () => editor
				})
			]
		});
	});

	afterEach(() => {
		editor?.destroy();
		container?.remove();
	});

	describe('Comprehensive Markdown', () => {
		it('should convert headers', () => {
			const markdown = `# H1
## H2
### H3`;
			simulatePaste(editor, markdown);
			const html = editor.getHTML();

			expect(html).toBe('<h1>H1</h1><h2>H2</h2><h3>H3</h3><p></p>');
		});

		it('should convert text formatting', () => {
			const markdown = 'Text with **bold**, *italic*, ~~strike~~, and `code`.';
			simulatePaste(editor, markdown);
			const html = editor.getHTML();

			expect(html).toBe(
				'<p>Text with <strong>bold</strong>, <em>italic</em>, <s>strike</s>, and <code>code</code>.</p>'
			);
		});

		it('should convert links', () => {
			const markdown = 'Check out [this link](https://example.com) here.';
			simulatePaste(editor, markdown);
			const html = editor.getHTML();

			expect(html).toBe(
				'<p>Check out <a target="_blank" rel="noopener noreferrer nofollow" href="https://example.com">this link</a> here.</p>'
			);
		});

		it('should convert unordered lists', () => {
			const markdown = `- Item 1
- Item 2
- Item 3`;
			simulatePaste(editor, markdown);
			const html = editor.getHTML();

			expect(html).toBe(
				'<ul><li><p>Item 1</p></li><li><p>Item 2</p></li><li><p>Item 3</p></li></ul><p></p>'
			);
		});

		it('should convert ordered lists', () => {
			const markdown = `1. First
2. Second
3. Third`;
			simulatePaste(editor, markdown);
			const html = editor.getHTML();

			expect(html).toBe(
				'<ol><li><p>First</p></li><li><p>Second</p></li><li><p>Third</p></li></ol><p></p>'
			);
		});

		it('should convert blockquotes', () => {
			const markdown = '> This is a quote';
			simulatePaste(editor, markdown);
			const html = editor.getHTML();

			expect(html).toBe('<blockquote><p>This is a quote</p></blockquote><p></p>');
		});

		it('should convert code blocks', () => {
			const markdown = '```javascript\nconst x = 1;\n```';
			simulatePaste(editor, markdown);
			const html = editor.getHTML();

			expect(html).toBe('<pre><code class="language-javascript">const x = 1;</code></pre><p></p>');
		});

		it('should convert code blocks with comments', () => {
			const markdown = '```sh\n# Install\nnpm install\n```';
			simulatePaste(editor, markdown);
			const html = editor.getHTML();

			expect(html).toBe(
				'<pre><code class="language-sh"># Install\nnpm install</code></pre><p></p>'
			);
		});

		it('should handle mixed content with proper structure', () => {
			const markdown = `# Title

Paragraph with **bold**.

- List item

> Quote`;

			simulatePaste(editor, markdown);
			const html = editor.getHTML();

			expect(html).toBe(
				'<h1>Title</h1><p>Paragraph with <strong>bold</strong>.</p><ul><li><p>List item</p></li></ul><blockquote><p>Quote</p></blockquote><p></p>'
			);
		});

		it('should handle README example', () => {
			const markdown = `> Blockquote with [link](https://example.com).


- Feature 1
- Feature 2

1. Step 1
2. Step 2`;

			simulatePaste(editor, markdown);
			const html = editor.getHTML();

			expect(html).toBe(
				'<blockquote><p>Blockquote with <a target="_blank" rel="noopener noreferrer nofollow" href="https://example.com">link</a>.</p></blockquote>' +
					'<ul><li><p>Feature 1</p></li><li><p>Feature 2</p></li></ul>' +
					'<ol><li><p>Step 1</p></li><li><p>Step 2</p></li></ol>' +
					'<p></p>'
			);
		});

		it('should handle all features together', () => {
			const markdown = `# Main

Text with **bold**, *italic*, and \`code\`.

## Lists

- Item A
- Item B

1. One
2. Two

> Quote

\`\`\`js
code();
\`\`\``;

			simulatePaste(editor, markdown);
			const html = editor.getHTML();

			expect(html).toBe(
				'<h1>Main</h1>' +
					'<p>Text with <strong>bold</strong>, <em>italic</em>, and <code>code</code>.</p>' +
					'<h2>Lists</h2>' +
					'<ul><li><p>Item A</p></li><li><p>Item B</p></li></ul>' +
					'<ol><li><p>One</p></li><li><p>Two</p></li></ol>' +
					'<blockquote><p>Quote</p></blockquote>' +
					'<pre><code class="language-js">code();</code></pre>' +
					'<p></p>'
			);
		});
	});

	describe('Non-Markdown Text', () => {
		it('should not interfere with plain text without markdown', () => {
			const text = 'Just plain text without any markdown';
			const spy = vi.spyOn(editor.commands, 'insertContent');

			simulatePaste(editor, text);

			// Should not call insertContent for non-markdown text
			expect(spy).not.toHaveBeenCalled();
		});
	});

	describe('Security - XSS Prevention', () => {
		it('should escape HTML in bold text', () => {
			const markdown = '**<script>alert("xss")</script>**';
			simulatePaste(editor, markdown);
			const html = editor.getHTML();

			expect(html).toContain('&lt;script&gt;');
			expect(html).not.toContain('<script>');
		});

		it('should escape HTML in italic text', () => {
			const markdown = '*<img src=x onerror=alert(1)>*';
			simulatePaste(editor, markdown);
			const html = editor.getHTML();

			expect(html).toContain('&lt;img');
			expect(html).not.toContain('<img');
		});

		it('should escape HTML in code blocks', () => {
			const markdown = '```javascript\n<script>alert("xss")</script>\n```';
			simulatePaste(editor, markdown);
			const html = editor.getHTML();

			expect(html).toContain('&lt;script&gt;');
			expect(html).not.toContain('<script>alert');
		});

		it('should escape HTML in inline code', () => {
			const markdown = 'Use `<script>alert(1)</script>` carefully';
			simulatePaste(editor, markdown);
			const html = editor.getHTML();

			expect(html).toContain('&lt;script&gt;');
			expect(html).not.toContain('<script>');
		});

		it('should escape HTML in headers', () => {
			const markdown = '# <script>alert("xss")</script>';
			simulatePaste(editor, markdown);
			const html = editor.getHTML();

			expect(html).toContain('&lt;script&gt;');
			expect(html).not.toContain('<script>');
		});

		it('should escape HTML in link text', () => {
			const markdown = '[<script>alert(1)</script>](https://example.com)';
			simulatePaste(editor, markdown);
			const html = editor.getHTML();

			expect(html).toContain('&lt;script&gt;');
			expect(html).not.toContain('<script>');
		});

		it('should block javascript: URLs', () => {
			const markdown = '[Click me](javascript:alert("xss"))';
			simulatePaste(editor, markdown);
			const html = editor.getHTML();

			// Should not have a link, just the text
			expect(html).not.toContain('javascript:');
			expect(html).toContain('Click me');
		});

		it('should block data: URLs', () => {
			const markdown = '[Click](data:text/html,<script>alert(1)</script>)';
			simulatePaste(editor, markdown);
			const html = editor.getHTML();

			expect(html).not.toContain('data:');
			expect(html).toContain('Click');
		});

		it('should allow safe http URLs', () => {
			const markdown = '[Safe link](http://example.com)';
			simulatePaste(editor, markdown);
			const html = editor.getHTML();

			expect(html).toContain('http://example.com');
		});

		it('should allow safe https URLs', () => {
			const markdown = '[Safe link](https://example.com)';
			simulatePaste(editor, markdown);
			const html = editor.getHTML();

			expect(html).toContain('https://example.com');
		});

		it('should allow mailto URLs', () => {
			const markdown = '[Email](mailto:test@example.com)';
			simulatePaste(editor, markdown);
			const html = editor.getHTML();

			expect(html).toContain('mailto:test@example.com');
		});

		it('should escape code block language attribute', () => {
			// Test with a language that contains only word characters (per regex \w+)
			// The escaping should still work for any potential injection
			const markdown = '```javascript\n<script>alert(1)</script>\n```';
			simulatePaste(editor, markdown);
			const html = editor.getHTML();

			// Language should be escaped in class attribute
			expect(html).toContain('class="language-javascript"');
			// Code content should be escaped
			expect(html).toContain('&lt;script&gt;');
			expect(html).not.toContain('<script>alert');
		});
	});
});

// Helper function to simulate paste events
function simulatePaste(editor: Editor, text: string) {
	const view = editor.view;
	const event = new ClipboardEvent('paste', {
		clipboardData: new DataTransfer()
	});

	// Add text to clipboard
	event.clipboardData?.setData('text/plain', text);

	// Dispatch the paste event
	view.dom.dispatchEvent(event);
}
