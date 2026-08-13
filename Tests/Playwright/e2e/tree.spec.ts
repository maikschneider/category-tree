import { expect, test } from '@playwright/test';
import {
  CATEGORY,
  contentFrame,
  expandNode,
  loginAsAdmin,
  node,
  nodeLabel,
  openCategoryModule,
  resetCategories,
  setUserTsConfig,
  switchToModule,
  searchTree,
  tree,
  visibleNodeNames,
} from '../support/typo3';

test.describe('Category tree navigation', () => {
  test.beforeEach(async ({ page }) => {
    resetCategories();
    await loginAsAdmin(page);
    await openCategoryModule(page);
  });

  test('replaces the page tree with the category tree', async ({ page }) => {
    await expect(tree(page)).toBeVisible();
    await expect(page.locator('typo3-backend-navigation-component-pagetree')).toHaveCount(0);
  });

  test('renders the tree at a usable height', async ({ page }) => {
    // Regression guard: without its own styles the custom element falls back to
    // display:inline and the fully loaded tree collapses to a zero-height box.
    const box = await tree(page).boundingBox();

    expect(box?.height ?? 0).toBeGreaterThan(200);
  });

  test('shows the root node and the top level categories', async ({ page }) => {
    await expect(nodeLabel(page, CATEGORY.root)).toHaveText('All categories');
    await expect(nodeLabel(page, CATEGORY.fruits)).toHaveText('Fruits');
    await expect(nodeLabel(page, CATEGORY.vegetables)).toHaveText('Vegetables');
  });

  test('hides categories that are deleted or translated', async ({ page }) => {
    const names = await visibleNodeNames(page);

    expect(names).not.toContain('Removed');
    expect(names).not.toContain('Frucht');
  });

  test('includes hidden categories', async ({ page }) => {
    await expandNode(page, CATEGORY.vegetables, CATEGORY.carrot);

    await expect(nodeLabel(page, CATEGORY.carrot)).toHaveText('Carrot');
  });

  test('loads deeper levels on demand', async ({ page }) => {
    // levelsToFetch defaults to 2, so Granny Smith is not part of the first payload.
    await expect(node(page, CATEGORY.grannySmith)).toHaveCount(0);

    await expandNode(page, CATEGORY.fruits, CATEGORY.apple);
    await expandNode(page, CATEGORY.apple, CATEGORY.grannySmith);

    await expect(nodeLabel(page, CATEGORY.grannySmith)).toHaveText('Granny Smith');
  });

  test('opens the record context menu on right click', async ({ page }) => {
    // Regression guard: the tree is rendered from a promise, so a component that binds
    // it on first update never gets one and the context menu silently does nothing.
    await node(page, CATEGORY.fruits).click({ button: 'right' });

    await expect(page.locator('.context-menu .context-menu-item').first()).toBeVisible();
    await expect(page.locator('.context-menu')).toContainText('Edit');
  });

  test('keeps the context menu closed for the synthetic root node', async ({ page }) => {
    await node(page, CATEGORY.root).click({ button: 'right' });

    await expect(page.locator('.context-menu')).toHaveCount(0);
  });

  test.describe('per-module settings', () => {
    test.afterEach(() => {
      setUserTsConfig('');
    });

    test('follows the settings of the module switched to', async ({ page }) => {
      // The backend shares one navigation component between the modules that declare it,
      // and the tree reads its setup only once — so without replacing the tree, the second
      // module would keep showing the first module's entry points until a page reload.
      // EXT:category_tree_second registers entryPoints = [5] and no root node.
      await switchToModule(page, 'category_tree_second');

      await expect(contentFrame(page).locator('#second-module')).toBeVisible({ timeout: 30000 });
      await expect(nodeLabel(page, CATEGORY.vegetables)).toHaveText('Vegetables');
      await expect(node(page, CATEGORY.root)).toHaveCount(0);
      await expect(node(page, CATEGORY.fruits)).toHaveCount(0);
    });

    test('restores its own settings when switching back', async ({ page }) => {
      await switchToModule(page, 'category_tree_second');
      await expect(node(page, CATEGORY.root)).toHaveCount(0);

      await switchToModule(page, 'category_tree');

      await expect(node(page, CATEGORY.root)).toBeVisible({ timeout: 30000 });
      await expect(nodeLabel(page, CATEGORY.fruits)).toHaveText('Fruits');
    });

    test('leaves out excluded categories and everything below them', async ({ page }) => {
      setUserTsConfig('mod.category_tree.categoryTree.excludeCategories = 2');
      await openCategoryModule(page);
      await expandNode(page, CATEGORY.fruits, CATEGORY.banana);

      await expect(node(page, CATEGORY.apple)).toHaveCount(0);
      await expect(node(page, CATEGORY.grannySmith)).toHaveCount(0);
      await expect(nodeLabel(page, CATEGORY.banana)).toHaveText('Banana');
    });

    test('applies the settings of the module the tree is rendered in', async ({ page }) => {
      setUserTsConfig(`mod.category_tree.categoryTree {
        showRootNode = 0
        entryPoints = 5
      }`);
      await openCategoryModule(page, { expectRootNode: false });

      await expect(node(page, CATEGORY.root)).toHaveCount(0);
      await expect(nodeLabel(page, CATEGORY.vegetables)).toHaveText('Vegetables');
      await expect(node(page, CATEGORY.fruits)).toHaveCount(0);
    });
  });

  test('filters the tree and keeps the ancestors of a match', async ({ page }) => {
    await searchTree(page, 'granny');

    await expect(node(page, CATEGORY.grannySmith)).toBeVisible();
    await expect(node(page, CATEGORY.apple)).toBeVisible();
    await expect(node(page, CATEGORY.fruits)).toBeVisible();
    await expect(node(page, CATEGORY.vegetables)).toHaveCount(0);
  });

  test('highlights the matching part of a filtered node', async ({ page }) => {
    await searchTree(page, 'granny');

    await expect(
      node(page, CATEGORY.grannySmith).locator('.node-highlight-text')
    ).toHaveText('Granny');
  });

  test('restores the full tree when the search is cleared', async ({ page }) => {
    await searchTree(page, 'granny');
    await expect(node(page, CATEGORY.vegetables)).toHaveCount(0);

    await searchTree(page, '');

    await expect(node(page, CATEGORY.vegetables)).toBeVisible();
  });
});
