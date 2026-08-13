import { expect, test } from '@playwright/test';
import {
  CATEGORY,
  categoryRow,
  confirmModal,
  deleteNode,
  dropNewCategoryOn,
  expandNode,
  loginAsAdmin,
  moveNode,
  newestCategoryUid,
  node,
  nodeLabel,
  openCategoryModule,
  resetCategories,
  startRename,
  submitNodeName,
  waitForCategoryByTitle,
} from '../support/typo3';

test.describe('Editing categories from the tree', () => {
  test.beforeEach(async ({ page }) => {
    resetCategories();
    await loginAsAdmin(page);
    await openCategoryModule(page);
  });

  test.describe('rename', () => {
    test('writes the new title to the record', async ({ page }) => {
      await startRename(page, CATEGORY.fruits);
      await submitNodeName(page, 'Obst');

      await expect(nodeLabel(page, CATEGORY.fruits)).toHaveText('Obst');
      expect(categoryRow(CATEGORY.fruits)?.title).toBe('Obst');
    });

    test('keeps the record untouched when the name is unchanged', async ({ page }) => {
      await startRename(page, CATEGORY.fruits);
      await submitNodeName(page, 'Fruits');

      expect(categoryRow(CATEGORY.fruits)?.title).toBe('Fruits');
    });

    test('does not clear the title when the input is emptied', async ({ page }) => {
      await startRename(page, CATEGORY.fruits);
      await submitNodeName(page, '');

      expect(categoryRow(CATEGORY.fruits)?.title).toBe('Fruits');
    });
  });

  test.describe('create', () => {
    test('creates a child below the drop target', async ({ page }) => {
      await dropNewCategoryOn(page, CATEGORY.vegetables, 'inside');
      await submitNodeName(page, 'Potato');

      const created = await waitForCategoryByTitle('Potato');
      expect(created.parent).toBe(String(CATEGORY.vegetables));
    });

    test('stores the new category on the pid of its parent', async ({ page }) => {
      await dropNewCategoryOn(page, CATEGORY.vegetables, 'inside');
      await submitNodeName(page, 'Potato');

      const created = await waitForCategoryByTitle('Potato');
      expect(created.pid).toBe(categoryRow(CATEGORY.vegetables)?.pid);
    });

    test('creates a sibling after the drop target', async ({ page }) => {
      await dropNewCategoryOn(page, CATEGORY.vegetables, 'after');
      await submitNodeName(page, 'Grains');

      const created = await waitForCategoryByTitle('Grains');
      expect(created.parent).toBe(categoryRow(CATEGORY.vegetables)?.parent);
    });

    test('shows the new category in the tree', async ({ page }) => {
      await dropNewCategoryOn(page, CATEGORY.vegetables, 'inside');
      await submitNodeName(page, 'Potato');

      const created = await waitForCategoryByTitle('Potato');
      await expect(nodeLabel(page, Number(created.uid))).toHaveText('Potato', { timeout: 30000 });
    });

    test('discards the pending node when no name is given', async ({ page }) => {
      const before = newestCategoryUid();

      await dropNewCategoryOn(page, CATEGORY.vegetables, 'inside');
      await submitNodeName(page, '');

      expect(newestCategoryUid()).toBe(before);
    });
  });

  test.describe('move and copy', () => {
    test('moves a category into another one', async ({ page }) => {
      await moveNode(page, CATEGORY.banana, CATEGORY.vegetables, 'inside');
      await confirmModal(page, 'move');

      await expect
        .poll(() => categoryRow(CATEGORY.banana)?.parent, { timeout: 30000 })
        .toBe(String(CATEGORY.vegetables));
    });

    test('copies a category instead of moving it', async ({ page }) => {
      const before = newestCategoryUid();

      await moveNode(page, CATEGORY.banana, CATEGORY.vegetables, 'inside');
      await confirmModal(page, 'copy');

      await expect.poll(() => newestCategoryUid(), { timeout: 30000 }).toBeGreaterThan(before);
      // The original stays where it was.
      expect(categoryRow(CATEGORY.banana)?.parent).toBe(String(CATEGORY.fruits));
    });

    test('leaves the record alone when the dialog is cancelled', async ({ page }) => {
      await moveNode(page, CATEGORY.banana, CATEGORY.vegetables, 'inside');
      await page.locator('typo3-backend-modal button[name="cancel"]').click();

      expect(categoryRow(CATEGORY.banana)?.parent).toBe(String(CATEGORY.fruits));
    });
  });

  test.describe('delete', () => {
    test('deletes a category after confirmation', async ({ page }) => {
      await deleteNode(page, CATEGORY.banana);
      await confirmModal(page, 'delete');

      await expect.poll(() => categoryRow(CATEGORY.banana), { timeout: 30000 }).toBeNull();
    });

    test('removes the node from the tree', async ({ page }) => {
      await deleteNode(page, CATEGORY.banana);
      await confirmModal(page, 'delete');

      await expect(node(page, CATEGORY.banana)).toHaveCount(0, { timeout: 30000 });
    });

    test('keeps the category when the dialog is cancelled', async ({ page }) => {
      await deleteNode(page, CATEGORY.banana);
      await page.locator('typo3-backend-modal button[name="cancel"]').click();

      expect(categoryRow(CATEGORY.banana)).not.toBeNull();
    });

    test('deletes the children along with the category', async ({ page }) => {
      await expandNode(page, CATEGORY.fruits, CATEGORY.apple);

      await deleteNode(page, CATEGORY.apple);
      await confirmModal(page, 'delete');

      await expect.poll(() => categoryRow(CATEGORY.apple), { timeout: 30000 }).toBeNull();
      expect(categoryRow(CATEGORY.grannySmith)).toBeNull();
    });
  });
});
