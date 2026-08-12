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

export function flushCaches(): void {
  const tables = mysql("SHOW TABLES LIKE 'cache\\_%';").split('\n').filter(Boolean);
  if (tables.length > 0) {
    mysql(tables.map((table) => `TRUNCATE TABLE \`${table}\`;`).join(' '));
  }
}

export async function loginAsAdmin(page: Page): Promise<void> {
  await page.goto('/typo3/');
  await page.fill('#t3-username', BACKEND_USER.username);
  await page.fill('#t3-password', BACKEND_USER.password);
  await page.click('#t3-login-submit');
  await expect(page.locator('.scaffold-header')).toBeVisible({ timeout: 30000 });
}

/**
* Opens the Categories module and waits until the tree has loaded, so specs never
* race the AJAX request that fills it.
*/
export async function openCategoryModule(page: Page): Promise<void> {
  await page.goto('/typo3/module/web/categories');
  await expect(node(page, CATEGORY.root)).toBeVisible({ timeout: 30000 });
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
