import { test, expect } from '@playwright/test';

// Helper to clear IndexedDB between tests
async function clearIndexedDB(page) {
	await page.evaluate(() => {
		return new Promise((resolve) => {
			const dbs = indexedDB.databases();
			dbs.then((databases) => {
				Promise.all(
					databases.map((db) => {
						if (db.name) {
							return new Promise((res) => {
								const req = indexedDB.deleteDatabase(db.name!);
								req.onsuccess = () => res(true);
								req.onerror = () => res(false);
							});
						}
						return Promise.resolve();
					})
				).then(() => resolve(true));
			});
		});
	});
}

// Helper to create a vault and get to the main notes view
async function createVaultAndLogin(page, vaultName = 'Test Vault', password = 'TestPassword123!') {
	// Navigate first, then clear, then reload
	await page.goto('http://localhost:4173/');
	await page.waitForLoadState('domcontentloaded');
	await clearIndexedDB(page);
	await page.reload();
	await page.waitForLoadState('domcontentloaded');

	// Create a new vault
	await page.getByRole('button', { name: 'Create New Vault' }).click();

	// Fill vault creation form
	await page.fill('input#vault-name', vaultName);
	const passwordInputs = await page.locator('input[type="password"]').all();
	await passwordInputs[0].fill(password);
	await passwordInputs[1].fill(password);

	// Submit vault creation
	await page.getByRole('button', { name: 'Create Vault' }).click();

	// Wait for vault to be created and redirected to main view
	await expect(page.getByRole('heading', { name: 'Notes', exact: true })).toBeVisible({
		timeout: 10000
	});

	// Wait for UI to settle
	await page.waitForTimeout(500);
}

// Helper to create a note
async function createNote(page, title = 'Test Note') {
	// Click the + button to create a new note in the sidebar
	const createNoteButton = page
		.locator('aside')
		.getByRole('button')
		.filter({ hasText: '' })
		.first();
	await createNoteButton.click();

	// Wait for note to be created
	await page.waitForTimeout(1000);

	// Look for the title button in the note header
	const noteHeader = page
		.locator('div.border-b')
		.filter({ has: page.getByRole('button', { name: /Tags/i }) });
	await expect(noteHeader).toBeVisible({ timeout: 5000 });

	const headerTitleButton = noteHeader.locator('button').filter({ hasText: 'Untitled Note' });
	await expect(headerTitleButton).toBeVisible({ timeout: 5000 });

	// Click on the title to edit it
	await headerTitleButton.click();
	await page.waitForTimeout(300);

	// Find the input that appears
	const titleInput = noteHeader.locator('input[placeholder="Untitled Note"]');
	await expect(titleInput).toBeVisible({ timeout: 3000 });

	// Type new title
	await titleInput.fill(title);
	await titleInput.press('Enter');

	// Wait for save
	await page.waitForTimeout(500);
}

test.describe('Note Deletion', () => {
	test.beforeEach(async ({ page }) => {
		await createVaultAndLogin(page);
	});

	test('should delete a note and show confirmation dialog', async ({ page }) => {
		// Create a note
		await createNote(page, 'Note to Delete');

		// Verify note exists in the sidebar
		await expect(page.locator('aside').getByText('Note to Delete').first()).toBeVisible();

		// Click the action menu button (three dots icon in the note header)
		const noteHeader = page
			.locator('div.border-b')
			.filter({ has: page.getByRole('button', { name: /Tags/i }) });
		// The more button is the last button in the note header (after Tags button)
		const allButtons = await noteHeader.getByRole('button').all();
		const moreButton = allButtons[allButtons.length - 1];
		await moreButton.click();

		// Click delete option in the dropdown
		await page.getByRole('menuitem', { name: /Delete Note/i }).click();

		// Verify confirmation dialog appears
		await expect(page.getByRole('heading', { name: 'Delete Note' })).toBeVisible();
		await expect(page.getByText('Are you sure you want to delete this note?')).toBeVisible();
		await expect(page.getByText('"Note to Delete"')).toBeVisible();

		// Confirm deletion
		await page.getByRole('button', { name: 'Delete Note' }).click();

		// Wait for deletion to complete
		await page.waitForTimeout(500);

		// Verify note is removed from sidebar
		await expect(page.locator('aside').getByText('Note to Delete')).not.toBeVisible();
	});

	test('should cancel note deletion', async ({ page }) => {
		// Create a note
		await createNote(page, 'Note to Keep');

		// Verify note exists
		await expect(page.locator('aside').getByText('Note to Keep').first()).toBeVisible();

		// Click the action menu button
		const noteHeader = page
			.locator('div.border-b')
			.filter({ has: page.getByRole('button', { name: /Tags/i }) });
		const allButtons = await noteHeader.getByRole('button').all();
		const moreButton = allButtons[allButtons.length - 1];
		await moreButton.click();

		// Click delete option
		await page.getByRole('menuitem', { name: /Delete Note/i }).click();

		// Verify confirmation dialog appears
		await expect(page.getByRole('heading', { name: 'Delete Note' })).toBeVisible();

		// Cancel deletion
		await page.getByRole('button', { name: 'Cancel' }).click();

		// Wait for dialog to close
		await page.waitForTimeout(300);

		// Verify note still exists in sidebar
		await expect(page.locator('aside').getByText('Note to Keep').first()).toBeVisible();
	});

	test('should select next note after deletion', async ({ page }) => {
		// Create multiple notes
		await createNote(page, 'First Note');
		await createNote(page, 'Second Note');
		await createNote(page, 'Third Note');

		// Wait for all notes to be created
		await page.waitForTimeout(500);

		// Verify all notes exist in sidebar
		await expect(page.locator('aside').getByText('First Note').first()).toBeVisible();
		await expect(page.locator('aside').getByText('Second Note').first()).toBeVisible();
		await expect(page.locator('aside').getByText('Third Note').first()).toBeVisible();

		// Click on the second note in the sidebar to select it
		await page.locator('aside').getByText('Second Note').first().click();
		await page.waitForTimeout(500);

		// Verify Second Note is shown in the header
		const noteHeader = page
			.locator('div.border-b')
			.filter({ has: page.getByRole('button', { name: /Tags/i }) });
		await expect(noteHeader.getByText('Second Note').first()).toBeVisible();

		// Delete the second note
		const allButtons = await noteHeader.getByRole('button').all();
		const moreButton = allButtons[allButtons.length - 1];
		await moreButton.click();
		await page.getByRole('menuitem', { name: /Delete Note/i }).click();
		await page.getByRole('button', { name: 'Delete Note' }).click();

		// Wait for deletion
		await page.waitForTimeout(500);

		// Verify second note is gone from sidebar
		await expect(page.locator('aside').getByText('Second Note')).not.toBeVisible();

		// Verify we're now viewing either First or Third note in the header
		const firstNoteInHeader = await noteHeader
			.getByText('First Note')
			.isVisible()
			.catch(() => false);
		const thirdNoteInHeader = await noteHeader
			.getByText('Third Note')
			.isVisible()
			.catch(() => false);
		expect(firstNoteInHeader || thirdNoteInHeader).toBe(true);
	});

	test('should show empty state after deleting all notes', async ({ page }) => {
		// Create a single note
		await createNote(page, 'Only Note');

		// Verify note exists
		await expect(page.locator('aside').getByText('Only Note').first()).toBeVisible();

		// Delete the note
		const noteHeader = page
			.locator('div.border-b')
			.filter({ has: page.getByRole('button', { name: /Tags/i }) });
		const allButtons = await noteHeader.getByRole('button').all();
		const moreButton = allButtons[allButtons.length - 1];
		await moreButton.click();
		await page.getByRole('menuitem', { name: /Delete Note/i }).click();
		await page.getByRole('button', { name: 'Delete Note' }).click();

		// Wait for deletion
		await page.waitForTimeout(500);

		// Verify note is gone
		await expect(page.locator('aside').getByText('Only Note')).not.toBeVisible();

		// Verify empty state or "No notes found" message
		await expect(page.getByText('No notes found')).toBeVisible();
	});

	test('should close dialog with Escape key', async ({ page }) => {
		// Create a note
		await createNote(page, 'Test Note');

		// Open delete dialog
		const noteHeader = page
			.locator('div.border-b')
			.filter({ has: page.getByRole('button', { name: /Tags/i }) });
		const allButtons = await noteHeader.getByRole('button').all();
		const moreButton = allButtons[allButtons.length - 1];
		await moreButton.click();
		await page.getByRole('menuitem', { name: /Delete Note/i }).click();

		// Verify dialog is open
		await expect(page.getByRole('heading', { name: 'Delete Note' })).toBeVisible();

		// Press Escape
		await page.keyboard.press('Escape');

		// Wait for dialog to close
		await page.waitForTimeout(300);

		// Verify note still exists
		await expect(page.locator('aside').getByText('Test Note').first()).toBeVisible();
	});

	test('should confirm deletion with Enter key', async ({ page }) => {
		// Create a note
		await createNote(page, 'Quick Delete');

		// Open delete dialog
		const noteHeader = page
			.locator('div.border-b')
			.filter({ has: page.getByRole('button', { name: /Tags/i }) });
		const allButtons = await noteHeader.getByRole('button').all();
		const moreButton = allButtons[allButtons.length - 1];
		await moreButton.click();
		await page.getByRole('menuitem', { name: /Delete Note/i }).click();

		// Verify dialog is open
		await expect(page.getByRole('heading', { name: 'Delete Note' })).toBeVisible();

		// Press Enter to confirm
		await page.keyboard.press('Enter');

		// Wait for deletion
		await page.waitForTimeout(500);

		// Verify note is deleted
		await expect(page.locator('aside').getByText('Quick Delete')).not.toBeVisible();
	});
});
