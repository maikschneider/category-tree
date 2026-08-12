import { expect, test } from '@playwright/test';
import {
  CATEGORY,
  contentFrame,
  expandNode,
  loginAsAdmin,
  node,
  openCategoryModule,
  resetCategories,
  selectNode,
} from '../support/typo3';

test.describe('Category management module', () => {
  test.beforeEach(async ({ page }) => {
    resetCategories();
    await loginAsAdmin(page);
    await openCategoryModule(page);
  });

  test('is registered with a translated title', async ({ page }) => {
    // The module registry hands out the raw "LLL:" reference; it has to be resolved.
    await expect(page.locator('.scaffold-sidebar')).toContainText('Categories');
    await expect(page).toHaveTitle(/^Categories/);
  });

  test('shows an empty state until a category is selected', async ({ page }) => {
    await expect(contentFrame(page).locator('.callout')).toContainText('No category selected');
  });

  test('opens the selected category in the regular record form', async ({ page }) => {
    await selectNode(page, CATEGORY.fruits);

    const form = contentFrame(page).locator('form[name="editform"]');
    await expect(form).toBeVisible({ timeout: 30000 });
    await expect(
      contentFrame(page).locator('input[data-formengine-input-name*="[title]"]')
    ).toHaveValue('Fruits');
  });

  test('keeps the selection marked in the tree', async ({ page }) => {
    await selectNode(page, CATEGORY.fruits);
    await expect(contentFrame(page).locator('form[name="editform"]')).toBeVisible({
      timeout: 30000,
    });

    await expect(node(page, CATEGORY.fruits)).toHaveClass(/node-selected/);
  });

  test('opens a lazily loaded category too', async ({ page }) => {
    await expandNode(page, CATEGORY.fruits, CATEGORY.apple);
    await expandNode(page, CATEGORY.apple, CATEGORY.grannySmith);

    await selectNode(page, CATEGORY.grannySmith);

    await expect(
      contentFrame(page).locator('input[data-formengine-input-name*="[title]"]')
    ).toHaveValue('Granny Smith', { timeout: 30000 });
  });

  test('returns to the module when the form is closed', async ({ page }) => {
    await selectNode(page, CATEGORY.fruits);
    await expect(contentFrame(page).locator('form[name="editform"]')).toBeVisible({
      timeout: 30000,
    });

    await contentFrame(page).locator('button[name="_close"], a[title="Close"]').first().click();

    await expect(contentFrame(page).locator('.callout')).toContainText('No category selected', {
      timeout: 30000,
    });
  });
});
