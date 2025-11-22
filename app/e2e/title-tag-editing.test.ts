import { test, expect } from '@playwright/test';
import { randomUUID } from 'crypto';

// Helper to generate unique vault name
function getUniqueVaultName() {
	return `Test Vault ${randomUUID()}`;
}

test.describe('Title and Tag Editing', () => {
	// No beforeEach needed - each test creates its own unique vault

	test('should create vault, note, and edit title', async ({ page }) => {
		await page.goto('http://localhost:4173/');
		
		const vaultName = getUniqueVaultName();
		
		// Create a new vault with unique name
		await page.getByRole('button', { name: 'Create New Vault' }).click();

		// Fill vault creation form with unique name
		await page.fill('input#vault-name', vaultName);
		const passwordInputs = await page.locator('input[type="password"]').all();
		await passwordInputs[0].fill('TestPassword123!');
		await passwordInputs[1].fill('TestPassword123!');

		// Submit vault creation
		await page.getByRole('button', { name: 'Create Vault' }).click();

		// Wait for vault to be created and redirected to main view
		await expect(page.getByRole('heading', { name: 'Notes', exact: true })).toBeVisible({
			timeout: 10000
		});

		// Wait for UI to settle
		await page.waitForTimeout(1000);

		// Create a new note - find button with Plus icon
		const createNoteButton = page
			.locator('aside')
			.getByRole('button')
			.filter({ hasText: '' })
			.first();
		await createNoteButton.click();

		// Wait for note to be created
		await page.waitForTimeout(1000);

		// Look for the title button in the note header (has Tags button, making it unique)
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
		await titleInput.fill('My First Note');
		await titleInput.press('Enter');

		// Verify title updated in header
		await expect(noteHeader.locator('button').filter({ hasText: 'My First Note' })).toBeVisible({
			timeout: 3000
		});

		// Verify title updated in sidebar
		await expect(page.locator('aside').getByText('My First Note')).toBeVisible({ timeout: 3000 });
	});

	test('should add and manage tags', async ({ page }) => {
		await page.goto('http://localhost:4173/');
		
		const vaultName = getUniqueVaultName();
		
		// Create vault with unique name
		await page.getByRole('button', { name: 'Create New Vault' }).click();
		await page.fill('input#vault-name', vaultName);
		const passwordInputs = await page.locator('input[type="password"]').all();
		await passwordInputs[0].fill('TestPassword123!');
		await passwordInputs[1].fill('TestPassword123!');
		await page.getByRole('button', { name: 'Create Vault' }).click();
		await expect(page.getByRole('heading', { name: 'Notes', exact: true })).toBeVisible({
			timeout: 10000
		});

		// Create a note
		await page.waitForTimeout(1000);
		const createNoteButton = page
			.locator('aside')
			.getByRole('button')
			.filter({ hasText: '' })
			.first();
		await createNoteButton.click();
		await page.waitForTimeout(1000);

		// Click on Tags button in the note header (not the sidebar filter)
		const noteHeader = page.locator('div.border-b');
		const tagsButton = noteHeader.getByRole('button', { name: 'Tags', exact: true });
		await expect(tagsButton).toBeVisible({ timeout: 5000 });
		await tagsButton.click();

		// Wait for tag dialog to open
		await expect(page.getByRole('heading', { name: 'Manage Tags' })).toBeVisible({ timeout: 2000 });

		// Add first tag
		const tagInput = page.locator('input#tag-input');
		await tagInput.fill('important');
		await tagInput.press('Enter');

		// Verify tag appears in the dialog
		await expect(page.locator('.bg-secondary').filter({ hasText: 'important' })).toBeVisible({
			timeout: 2000
		});

		// Add second tag
		await tagInput.fill('work');
		await tagInput.press('Enter');
		await expect(page.locator('.bg-secondary').filter({ hasText: 'work' })).toBeVisible({
			timeout: 2000
		});

		// Save tags
		await page.getByRole('button', { name: 'Save Tags' }).click();

		// Verify dialog closed
		await expect(page.getByRole('heading', { name: 'Manage Tags' })).not.toBeVisible({
			timeout: 2000
		});

		// Check if tags appear in the header
		await expect(page.locator('div.border-b').locator('.bg-secondary').first()).toBeVisible({
			timeout: 3000
		});
	});

	test('should show tag autocomplete with existing tags', async ({ page }) => {
		await page.goto('http://localhost:4173/');
		
		const vaultName = getUniqueVaultName();
		
		// Create vault with unique name
		await page.getByRole('button', { name: 'Create New Vault' }).click();
		await page.fill('input#vault-name', vaultName);
		const passwordInputs = await page.locator('input[type="password"]').all();
		await passwordInputs[0].fill('TestPassword123!');
		await passwordInputs[1].fill('TestPassword123!');
		await page.getByRole('button', { name: 'Create Vault' }).click();
		await expect(page.getByRole('heading', { name: 'Notes', exact: true })).toBeVisible({
			timeout: 10000
		});

		// Create first note and add tags
		await page.waitForTimeout(1000);
		const createNoteButton = page
			.locator('aside')
			.getByRole('button')
			.filter({ hasText: '' })
			.first();
		await createNoteButton.click();
		await page.waitForTimeout(1000);

		const noteHeaderLoc = page.locator('div.border-b');
		const tagsButton = noteHeaderLoc.getByRole('button', { name: 'Tags', exact: true });
		await tagsButton.click();
		await expect(page.getByRole('heading', { name: 'Manage Tags' })).toBeVisible({ timeout: 2000 });

		const tagInput = page.locator('input#tag-input');
		await tagInput.fill('important');
		await tagInput.press('Enter');
		await tagInput.fill('urgent');
		await tagInput.press('Enter');
		await page.getByRole('button', { name: 'Save Tags' }).click();

		// Create second note
		await page.waitForTimeout(500);
		await createNoteButton.click();
		await page.waitForTimeout(1000);

		// Open tags dialog for second note
		await tagsButton.click();
		await expect(page.getByRole('heading', { name: 'Manage Tags' })).toBeVisible({ timeout: 2000 });

		// Start typing to trigger autocomplete
		await tagInput.fill('imp');

		// Wait a moment for autocomplete to appear
		await page.waitForTimeout(300);

		// Autocomplete should show "important"
		const autocompleteButton = page.locator('.bg-popover button').filter({ hasText: 'important' });
		await expect(autocompleteButton).toBeVisible({ timeout: 2000 });

		// Click the autocomplete suggestion
		await autocompleteButton.click();

		// Verify tag was added (in the dialog, not sidebar)
		const dialog = page.locator('.fixed.inset-0.z-50');
		await expect(dialog.locator('.bg-secondary').filter({ hasText: 'important' })).toBeVisible({
			timeout: 2000
		});
	});

	test('should persist title and tags across note switches', async ({ page }) => {
		await page.goto('http://localhost:4173/');
		
		const vaultName = getUniqueVaultName();
		
		// Create vault with unique name
		await page.getByRole('button', { name: 'Create New Vault' }).click();
		await page.fill('input#vault-name', vaultName);
		const passwordInputs = await page.locator('input[type="password"]').all();
		await passwordInputs[0].fill('TestPassword123!');
		await passwordInputs[1].fill('TestPassword123!');
		await page.getByRole('button', { name: 'Create Vault' }).click();
		await expect(page.getByRole('heading', { name: 'Notes', exact: true })).toBeVisible({
			timeout: 10000
		});

		// Create and edit first note
		await page.waitForTimeout(1000);
		const createNoteButton = page
			.locator('aside')
			.getByRole('button')
			.filter({ hasText: '' })
			.first();
		await createNoteButton.click();
		await page.waitForTimeout(1000);

		// Edit title
		const noteHeader = page.locator('div.border-b');
		const headerTitleButton = noteHeader.locator('button').filter({ hasText: 'Untitled Note' });
		await expect(headerTitleButton).toBeVisible({ timeout: 5000 });
		await headerTitleButton.click();
		await page.waitForTimeout(300);

		const titleInput = noteHeader.locator('input[placeholder="Untitled Note"]');
		await expect(titleInput).toBeVisible({ timeout: 3000 });
		await titleInput.fill('Note One');
		await titleInput.press('Enter');

		// Add tags
		await noteHeader.getByRole('button', { name: 'Tags', exact: true }).click();
		const tagInput = page.locator('input#tag-input');
		await tagInput.fill('personal');
		await tagInput.press('Enter');
		await page.getByRole('button', { name: 'Save Tags' }).click();

		// Wait for save to complete
		await page.waitForTimeout(500);

		// Create second note
		await createNoteButton.click();
		await page.waitForTimeout(1000);

		// Edit second note title
		const headerTitleButton2 = page
			.locator('div.border-b')
			.locator('button')
			.filter({ hasText: 'Untitled Note' });
		await expect(headerTitleButton2).toBeVisible({ timeout: 5000 });
		await headerTitleButton2.click();
		await page.waitForTimeout(300);

		const titleInput2 = page.locator('div.border-b').locator('input[placeholder="Untitled Note"]');
		await expect(titleInput2).toBeVisible({ timeout: 3000 });
		await titleInput2.fill('Note Two');
		await titleInput2.press('Enter');

		// Wait for save
		await page.waitForTimeout(500);

		// Switch back to first note by clicking in sidebar
		await page.locator('aside').getByRole('button').filter({ hasText: 'Note One' }).click();
		await page.waitForTimeout(500);

		// Verify first note title is still there
		await expect(page.locator('button').filter({ hasText: 'Note One' }).first()).toBeVisible({
			timeout: 3000
		});

		// Verify first note tag is still there
		await expect(
			page.locator('div.border-b').locator('.bg-secondary').filter({ hasText: 'personal' })
		).toBeVisible({ timeout: 3000 });

		// Switch to second note
		await page.locator('aside').getByRole('button').filter({ hasText: 'Note Two' }).click();
		await page.waitForTimeout(500);

		// Verify second note title
		await expect(page.locator('button').filter({ hasText: 'Note Two' }).first()).toBeVisible({
			timeout: 3000
		});
	});
});
