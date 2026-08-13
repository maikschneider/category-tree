import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { expect, FrameLocator, Locator, Page } from '@playwright/test';

export const PROJECT_ROOT = '/var/www/html';
export const FIXTURE_PATH = path.join(PROJECT_ROOT, 'Tests/Functional/Fixtures');

const DB = { host: 'db', user: 'db', password: 'db', name: 'db' };

/** Matches the defaults of `ddev init-typo3`. */
export const BACKEND_USER = {
  username: process.env.TYPO3_SETUP_ADMIN_USERNAME || 'admin',
  password: process.env.TYPO3_SETUP_ADMIN_PASSWORD || 'Passw0rd!',
};

/**
* The categories of Tests/Functional/Fixtures/sys_category.csv, which both the
* functional tests and `ddev init-typo3` load.
*/
export const CATEGORY = {
  root: 0,
  fruits: 1,
  apple: 2,
  banana: 3,
  grannySmith: 4,
  vegetables: 5,
  carrot: 6,
} as const;

export function mysql(sql: string): string {
  return execFileSync(
    'mysql',
    [`-h${DB.host}`, `-u${DB.user}`, `-p${DB.password}`, '-N', '-s', DB.name],
    { input: sql, encoding: 'utf-8' }
  ).trim();
}

/**
* Restores sys_category from the functional test fixture, so every spec starts from
* the same tree no matter what the previous one created, renamed or deleted.
*/
export function resetCategories(): void {
  const rows = fs
    .readFileSync(path.join(FIXTURE_PATH, 'sys_category.csv'), 'utf-8')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split(',').map((value) => value.replace(/^"|"$/g, '')));

  const columns = rows[1].slice(1);
  const values = rows
    .slice(2)
    .map((row) => '(' + row.slice(1).map((value) => `'${value}'`).join(', ') + ')');

  mysql(
    'TRUNCATE TABLE sys_category;' +
    `INSERT INTO sys_category (${columns.map((column) => `\`${column}\``).join(', ')}) ` +
    `VALUES ${values.join(', ')};`
  );
  flushCaches();
}

export function countCategories(where: Record<string, string | number>): number {
  const condition = Object.entries(where)
    .map(([column, value]) =>
      `\`${column}\` = ` +
      (typeof value === 'number' ? value : `'${value.replace(/'/g, "''")}'`)
    )
    .join(' AND ');

  return Number(mysql(`SELECT COUNT(*) FROM sys_category WHERE ${condition};`));
}

/**
* Writes User TSconfig for the backend user the tests log in as. TSconfig is cached, so
* the caches go with it.
*/
export function setUserTsConfig(tsConfig: string): void {
  mysql(
    `UPDATE be_users SET TSconfig = '${tsConfig.replace(/'/g, "''")}' WHERE username = '${BACKEND_USER.username}';`
  );
  flushCaches();
}

export function flushCaches(): void {
  const tables = mysql("SHOW TABLES LIKE 'cache\\_%';").split('\n').filter(Boolean);
  if (tables.length > 0) {
    mysql(tables.map((table) => `TRUNCATE TABLE \`${table}\`;`).join(' '));
  }
}

/**
* The backend keeps its module iframe busy long after the page is usable, so every
* navigation waits for an element that proves readiness instead of for "load".
*/
const NAVIGATION = { waitUntil: 'domcontentloaded' } as const;
const READY_TIMEOUT = 60000;

export async function loginAsAdmin(page: Page): Promise<void> {
  await page.goto('/typo3/', NAVIGATION);
  await page.fill('#t3-username', BACKEND_USER.username);
  await page.fill('#t3-password', BACKEND_USER.password);
  await page.click('#t3-login-submit');
  await expect(page.locator('.scaffold-header')).toBeVisible({ timeout: READY_TIMEOUT });
}

/**
* Opens the Categories module and waits until the tree has loaded, so specs never
* race the AJAX request that fills it.
*/
export async function openCategoryModule(
  page: Page,
  options: { expectRootNode?: boolean } = {}
): Promise<void> {
  await page.goto('/typo3/module/web/categories', NAVIGATION);
  // The root node is the first thing the tree renders, unless it was configured away.
  const rendered = options.expectRootNode === false ? tree(page).locator('.node') : node(page, CATEGORY.root);
  await expect(rendered.first()).toBeVisible({ timeout: READY_TIMEOUT });
}

/**
* Switches modules the way an editor does, through the module menu, so the backend stays on
* the page it is on. A reload would hide anything the navigation component caches.
*/
export async function switchToModule(page: Page, identifier: string): Promise<void> {
  await page.locator(`[data-modulemenu-identifier="${identifier}"]`).click();
}

export function tree(page: Page): Locator {
  return page.locator('typo3-backend-navigation-component-category-tree-tree');
}

/** A tree node addressed by its category uid; the synthetic root node is uid 0. */
export function node(page: Page, uid: number): Locator {
  return tree(page).locator(`[role="treeitem"][data-id="${uid}"]`);
}

export function nodeLabel(page: Page, uid: number): Locator {
  return node(page, uid).locator('.node-name');
}

export function visibleNodeNames(page: Page): Promise<string[]> {
  return tree(page).locator('[role="treeitem"] .node-name').allInnerTexts();
}

/** Expands a node and waits for the given child to appear. */
export async function expandNode(page: Page, uid: number, expectedChild: number): Promise<void> {
  await node(page, uid).locator('.node-toggle').click();
  await expect(node(page, expectedChild)).toBeVisible();
}

export async function selectNode(page: Page, uid: number): Promise<void> {
  await node(page, uid).locator('.node-contentlabel').click();
}

export async function searchTree(page: Page, term: string): Promise<void> {
  await page.locator('typo3-backend-navigation-component-category-tree #toolbarSearch').fill(term);
}

/** The TYPO3 backend renders modules inside this iframe. */
export function contentFrame(page: Page): FrameLocator {
  return page.frameLocator('[name="list_frame"]');
}

/** Opens the record context menu of a node and clicks one of its items. */
export async function contextMenuAction(page: Page, uid: number, label: string): Promise<void> {
  await node(page, uid).click({ button: 'right' });
  const item = page.locator('.context-menu .context-menu-item', { hasText: label }).first();
  await expect(item).toBeVisible();
  await item.click();
}

//
// Write operations
//
// Creating, moving, copying and deleting a node all happen by dropping something onto
// the tree, and HTML5 drag and drop cannot be simulated faithfully from Playwright.
// These helpers therefore call the same public tree methods the drop handler calls
// (Tree::addNode / moveNode / deleteNode), which is where this extension's own code
// takes over. Only the browser's drag plumbing — core's code — is skipped.
//

export type NodePosition = 'inside' | 'before' | 'after';

const TREE_SELECTOR = 'typo3-backend-navigation-component-category-tree-tree';
const TOOLBAR_DRAG_ITEM =
  'typo3-backend-navigation-component-category-tree-toolbar .tree-toolbar__drag-node';

/** The inline rename/create input the tree shows on the node currently being edited. */
export function editInput(page: Page): Locator {
  return tree(page).locator('input.node-edit');
}

/** Types a name into the inline input and confirms it. */
export async function submitNodeName(page: Page, name: string): Promise<void> {
  await editInput(page).fill(name);
  await editInput(page).press('Enter');
}

/** Opens the inline rename input of an existing node the way an editor does. */
export async function startRename(page: Page, uid: number): Promise<void> {
  await node(page, uid).locator('.node-contentlabel').dblclick();
  await expect(editInput(page)).toBeVisible();
}

/**
* Starts a "new category" drag on the toolbar and drops it onto the given node,
* leaving the tree in inline-edit mode for the new node.
*/
export async function dropNewCategoryOn(
  page: Page,
  targetUid: number,
  position: NodePosition = 'inside'
): Promise<void> {
  await page.evaluate(
    ([treeSelector, dragItemSelector, uid, pos]) => {
      const item = document.querySelector(dragItemSelector as string);
      // Populates tree.draggingNode through the toolbar's own dragstart handler.
      item.dispatchEvent(
        new DragEvent('dragstart', { dataTransfer: new DataTransfer(), bubbles: true })
      );

      const treeElement = document.querySelector(treeSelector as string) as any;
      const target = treeElement.nodes.find((n: any) => n.identifier === String(uid));
      return treeElement.addNode(treeElement.draggingNode, target, pos);
    },
    [TREE_SELECTOR, TOOLBAR_DRAG_ITEM, targetUid, position] as const
  );

  await expect(editInput(page)).toBeVisible();
}

export async function moveNode(
  page: Page,
  uid: number,
  targetUid: number,
  position: NodePosition
): Promise<void> {
  await callTreeMethod(page, 'moveNode', uid, targetUid, position);
}

export async function deleteNode(page: Page, uid: number): Promise<void> {
  await callTreeMethod(page, 'deleteNode', uid);
}

/** Clicks a button of the confirmation modal the tree opens for move, copy and delete. */
export async function confirmModal(page: Page, button: 'move' | 'copy' | 'delete'): Promise<void> {
  const action = page.locator(`typo3-backend-modal button[name="${button}"]`);
  await expect(action).toBeVisible({ timeout: 30000 });
  await action.click();
  await expect(page.locator('typo3-backend-modal')).toHaveCount(0, { timeout: 30000 });
}

async function callTreeMethod(
  page: Page,
  method: 'moveNode' | 'deleteNode',
  uid: number,
  targetUid?: number,
  position?: NodePosition
): Promise<void> {
  await page.evaluate(
    ([treeSelector, methodName, nodeUid, target, pos]) => {
      const treeElement = document.querySelector(treeSelector as string) as any;
      const find = (id: unknown) => treeElement.nodes.find((n: any) => n.identifier === String(id));

      return methodName === 'deleteNode'
        ? treeElement.deleteNode(find(nodeUid))
        : treeElement.moveNode(find(nodeUid), find(target), pos);
    },
    [TREE_SELECTOR, method, uid, targetUid, position] as const
  );
}

/**
* A single category row, or null when it does not exist. Deleted rows are excluded,
* so a soft-deleted category reads as gone.
*/
export function categoryRow(uid: number): Record<string, string> | null {
  const row = mysql(
    `SELECT uid, pid, title, parent, sorting, deleted FROM sys_category WHERE uid = ${uid};`
  );
  if (row === '') {
    return null;
  }

  const [id, pid, title, parent, sorting, deleted] = row.split('\t');
  return deleted === '1' ? null : { uid: id, pid, title, parent, sorting };
}

/**
* Waits for a category to appear under the given title and returns its row.
*
* DataHandler is written to over AJAX after the keystroke that confirms an edit, so
* reading the table straight away races the request.
*/
export async function waitForCategoryByTitle(title: string): Promise<Record<string, string>> {
  await expect.poll(() => categoryUidByTitle(title), { timeout: 30000 }).not.toBeNull();

  return categoryRow(categoryUidByTitle(title)) as Record<string, string>;
}

/** The uid of the category with this title, or null while it does not exist (yet). */
export function categoryUidByTitle(title: string): number | null {
  const uid = mysql(
    `SELECT uid FROM sys_category WHERE title = '${title.replace(/'/g, "''")}' AND deleted = 0;`
  );

  return uid === '' ? null : Number(uid);
}

/** The uid of the most recently created category, for asserting on a fresh record. */
export function newestCategoryUid(): number {
  return Number(mysql('SELECT MAX(uid) FROM sys_category;'));
}
