# Acceptance tests

End-to-end tests driving the real TYPO3 backend through Playwright, provided by the
[ddev-playwright](https://github.com/xima-media/ddev-playwright) add-on.

```bash
ddev init-typo3          # once, for a backend with the demo categories
ddev playwright test
ddev playwright show-report
```

`ddev playwright test --headed` and `--debug` work as usual; the add-on exposes a VNC
session for watching a run.

## What is covered

`e2e/tree.spec.ts` — the navigation component: it replaces the page tree, renders at a
usable height, shows the root node and top-level categories, hides deleted and translated
records, includes hidden ones, loads deeper levels on demand, and filters while keeping the
ancestors of a match.

`e2e/module.spec.ts` — the Categories module: registration and translated title, the empty
state, opening a category (including a lazily loaded one) in the regular record form,
marking the selection in the tree, and returning to the module when the form is closed.

`e2e/write.spec.ts` — editing from the tree: renaming a node, creating a category as a
child or a sibling, moving and copying with the confirmation dialog, and deleting a
category together with its branch.

Three of these are regression guards for bugs that only appeared in a real backend and that
no PHP test could have caught: the parent module's page tree overriding the navigation
component, the tree collapsing to zero height for lack of its own styles, and the context
menu staying silent because the tree reference was taken before the tree existed.

## The second module

`Tests/Fixtures/Extensions/category_tree_second` is an acceptance fixture: a module that
declares the same navigation component and registers settings of its own (`entryPoints`,
no root node). It is required as a path repository in `require-dev`, so `ddev composer
install` sets it up, and it exists to test what only shows up between two modules — the
backend shares one navigation component instance between them.

## Conventions

- Nodes are addressed by category uid (`node(page, CATEGORY.apple)`), not by label — the
  uids come from `Tests/Functional/Fixtures/sys_category.csv`, which both these tests and
  `ddev init-typo3` load.
- `resetCategories()` restores that fixture in `beforeEach`, so specs may create, rename
  and delete freely. The suite runs serially for the same reason.
- Writes go through DataHandler over AJAX, so assertions on the database wait for the row
  (`waitForCategoryByTitle`) instead of reading it right after the keystroke.
- Backend credentials default to those of `ddev init-typo3` and can be overridden with
  `TYPO3_SETUP_ADMIN_USERNAME` / `TYPO3_SETUP_ADMIN_PASSWORD`.
- Helpers live in `support/typo3.ts`; add new ones there rather than reaching into the DOM
  from a spec.
