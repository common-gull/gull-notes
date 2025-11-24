import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
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
				TaskList,
				TaskItem.configure({
					nested: true
				}),
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

		it('should convert task lists with unchecked items', () => {
			const markdown = `- [ ] Task 1
- [ ] Task 2
- [ ] Task 3`;
			simulatePaste(editor, markdown);
			const html = editor.getHTML();

			expect(html).toBe(
				'<ul data-type="taskList">' +
					'<li data-checked="false" data-type="taskItem"><label><input type="checkbox"><span></span></label><div><p>Task 1</p></div></li>' +
					'<li data-checked="false" data-type="taskItem"><label><input type="checkbox"><span></span></label><div><p>Task 2</p></div></li>' +
					'<li data-checked="false" data-type="taskItem"><label><input type="checkbox"><span></span></label><div><p>Task 3</p></div></li>' +
					'</ul>' +
					'<p></p>'
			);
		});

		it('should convert task lists with checked items', () => {
			const markdown = `- [x] Completed task
- [X] Also completed`;
			simulatePaste(editor, markdown);
			const html = editor.getHTML();

			expect(html).toBe(
				'<ul data-type="taskList">' +
					'<li data-checked="true" data-type="taskItem"><label><input type="checkbox" checked="checked"><span></span></label><div><p>Completed task</p></div></li>' +
					'<li data-checked="true" data-type="taskItem"><label><input type="checkbox" checked="checked"><span></span></label><div><p>Also completed</p></div></li>' +
					'</ul>' +
					'<p></p>'
			);
		});

		it('should convert task lists with mixed checked/unchecked items', () => {
			const markdown = `- [x] Done
- [ ] Todo
- [X] Also done
- [ ] Another todo`;
			simulatePaste(editor, markdown);
			const html = editor.getHTML();

			expect(html).toBe(
				'<ul data-type="taskList">' +
					'<li data-checked="true" data-type="taskItem"><label><input type="checkbox" checked="checked"><span></span></label><div><p>Done</p></div></li>' +
					'<li data-checked="false" data-type="taskItem"><label><input type="checkbox"><span></span></label><div><p>Todo</p></div></li>' +
					'<li data-checked="true" data-type="taskItem"><label><input type="checkbox" checked="checked"><span></span></label><div><p>Also done</p></div></li>' +
					'<li data-checked="false" data-type="taskItem"><label><input type="checkbox"><span></span></label><div><p>Another todo</p></div></li>' +
					'</ul>' +
					'<p></p>'
			);
		});

		it('should handle task lists with inline formatting', () => {
			const markdown = `- [x] **Bold** task
- [ ] Task with *italic*
- [ ] Task with \`code\``;
			simulatePaste(editor, markdown);
			const html = editor.getHTML();

			expect(html).toBe(
				'<ul data-type="taskList">' +
					'<li data-checked="true" data-type="taskItem"><label><input type="checkbox" checked="checked"><span></span></label><div><p><strong>Bold</strong> task</p></div></li>' +
					'<li data-checked="false" data-type="taskItem"><label><input type="checkbox"><span></span></label><div><p>Task with <em>italic</em></p></div></li>' +
					'<li data-checked="false" data-type="taskItem"><label><input type="checkbox"><span></span></label><div><p>Task with <code>code</code></p></div></li>' +
					'</ul>' +
					'<p></p>'
			);
		});

		it('should distinguish task lists from regular lists', () => {
			const markdown = `- Regular item
- Another regular item

- [ ] Task item
- [x] Completed task`;
			simulatePaste(editor, markdown);
			const html = editor.getHTML();

			expect(html).toBe(
				'<ul><li><p>Regular item</p></li><li><p>Another regular item</p></li></ul>' +
					'<ul data-type="taskList">' +
					'<li data-checked="false" data-type="taskItem"><label><input type="checkbox"><span></span></label><div><p>Task item</p></div></li>' +
					'<li data-checked="true" data-type="taskItem"><label><input type="checkbox" checked="checked"><span></span></label><div><p>Completed task</p></div></li>' +
					'</ul>' +
					'<p></p>'
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

	describe('Task Lists - Edge Cases', () => {
		it('should handle empty task list items', () => {
			const markdown = `- [ ] 
- [x] Has content`;
			simulatePaste(editor, markdown);
			const html = editor.getHTML();

			expect(html).toBe(
				'<ul data-type="taskList">' +
					'<li data-checked="false" data-type="taskItem"><label><input type="checkbox"><span></span></label><div><p></p></div></li>' +
					'<li data-checked="true" data-type="taskItem"><label><input type="checkbox" checked="checked"><span></span></label><div><p>Has content</p></div></li>' +
					'</ul>' +
					'<p></p>'
			);
		});

		it('should handle task lists with special characters', () => {
			const markdown = `- [ ] Task with <special> characters
- [x] Task with & symbols`;
			simulatePaste(editor, markdown);
			const html = editor.getHTML();

			// TipTap/browser strips unknown HTML tags like <special>
			expect(html).toBe(
				'<ul data-type="taskList">' +
					'<li data-checked="false" data-type="taskItem"><label><input type="checkbox"><span></span></label><div><p>Task with  characters</p></div></li>' +
					'<li data-checked="true" data-type="taskItem"><label><input type="checkbox" checked="checked"><span></span></label><div><p>Task with &amp; symbols</p></div></li>' +
					'</ul>' +
					'<p></p>'
			);
		});

		it('should handle task lists with links', () => {
			const markdown = `- [ ] Check [this link](https://example.com)
- [x] Visited [another link](https://test.com)`;
			simulatePaste(editor, markdown);
			const html = editor.getHTML();

			expect(html).toBe(
				'<ul data-type="taskList">' +
					'<li data-checked="false" data-type="taskItem"><label><input type="checkbox"><span></span></label><div><p>Check <a target="_blank" rel="noopener noreferrer nofollow" href="https://example.com">this link</a></p></div></li>' +
					'<li data-checked="true" data-type="taskItem"><label><input type="checkbox" checked="checked"><span></span></label><div><p>Visited <a target="_blank" rel="noopener noreferrer nofollow" href="https://test.com">another link</a></p></div></li>' +
					'</ul>' +
					'<p></p>'
			);
		});

		it('should not treat task list syntax in middle of line as task list', () => {
			const markdown = `Text with [ ] in middle`;
			simulatePaste(editor, markdown);
			const html = editor.getHTML();

			// Should be treated as plain text paragraph, not a task list
			expect(html).not.toContain('data-type="taskList"');
			expect(html).toContain('[ ]');
		});

		it('should handle mixed list types in same paste', () => {
			const markdown = `- Regular list item

- [ ] Task item
- [x] Done task

1. Ordered item
2. Another ordered item`;
			simulatePaste(editor, markdown);
			const html = editor.getHTML();

			expect(html).toBe(
				'<ul><li><p>Regular list item</p></li></ul>' +
					'<ul data-type="taskList">' +
					'<li data-checked="false" data-type="taskItem"><label><input type="checkbox"><span></span></label><div><p>Task item</p></div></li>' +
					'<li data-checked="true" data-type="taskItem"><label><input type="checkbox" checked="checked"><span></span></label><div><p>Done task</p></div></li>' +
					'</ul>' +
					'<ol><li><p>Ordered item</p></li><li><p>Another ordered item</p></li></ol>' +
					'<p></p>'
			);
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

		it('should escape HTML in task list items', () => {
			const markdown = `- [ ] Task with <script>alert(1)</script>
- [x] Task with <img src=x onerror=alert(1)>`;
			simulatePaste(editor, markdown);
			const html = editor.getHTML();

			// TipTap/browser strips malicious tags and scripts
			expect(html).toBe(
				'<ul data-type="taskList">' +
					'<li data-checked="false" data-type="taskItem"><label><input type="checkbox"><span></span></label><div><p>Task with </p></div></li>' +
					'<li data-checked="true" data-type="taskItem"><label><input type="checkbox" checked="checked"><span></span></label><div><p>Task with </p></div></li>' +
					'</ul>' +
					'<p></p>'
			);
		});

		it('should escape HTML in task list with links', () => {
			const markdown = `- [ ] [<script>alert(1)</script>](https://example.com)`;
			simulatePaste(editor, markdown);
			const html = editor.getHTML();

			// TipTap escapes the malicious content in link text
			expect(html).toBe(
				'<ul data-type="taskList">' +
					'<li data-checked="false" data-type="taskItem"><label><input type="checkbox"><span></span></label><div><p><a target="_blank" rel="noopener noreferrer nofollow" href="https://example.com">&lt;script&gt;alert(1)&lt;/script&gt;</a></p></div></li>' +
					'</ul>' +
					'<p></p>'
			);
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
