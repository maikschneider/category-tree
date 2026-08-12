# Category Tree

A reusable **category tree navigation component** for TYPO3 backend modules — plus an
optional backend module for managing categories.

Any backend module can declare the tree as its navigation component. Selecting a node
reloads the module with a `category=<uid>` query parameter; what the module does with that
is entirely up to the module. The tree itself handles creating, renaming, moving, copying,
deleting and searching `sys_category` records.

| | |
|---|---|
| **TYPO3** | 13.4 LTS, 14.3 LTS |
| **PHP** | 8.2, 8.3, 8.4 |
| **Extension key** | `category_tree` |
| **License** | GPL-2.0-or-later |

## Installation

```bash
composer require maikschneider/category-tree
```

That is all that is needed for the navigation component. The **Web > Categories** module is
registered automatically and can be switched off in the extension configuration.

## Using the tree in your own module

Declare it as the `navigationComponent` of your module in
`Configuration/Backend/Modules.php`:

```php
return [
    'myext_reports' => [
        'parent' => 'web',
        'access' => 'user',
        'labels' => 'LLL:EXT:my_ext/Resources/Private/Language/locallang_mod.xlf',
        // Required: the parent module ships the page tree, and submodules inherit it
        // unless inheritance is switched off. Without this you get the page tree.
        'inheritNavigationComponentFromMainModule' => false,
        'navigationComponent' => '@maikschneider/category-tree/category-tree-element',
        'routes' => [
            '_default' => [
                'target' => \Vendor\MyExt\Controller\ReportController::class . '::handleRequest',
            ],
        ],
    ],
];
```

Then read the selected category in your controller:

```php
public function handleRequest(ServerRequestInterface $request): ResponseInterface
{
    $categoryUid = (int)($request->getQueryParams()['category'] ?? 0);
    // 0 means "no category selected" — the tree's root node clears the parameter.
}
```

That is the entire contract. The tree keeps the rest of your module's query parameters
intact when the selection changes, so paging, filters and sorting survive a click in the
tree.

### Extbase modules

Extbase modules work the same way; read the parameter from the request:

```php
$categoryUid = (int)($this->request->getQueryParams()['category'] ?? 0);
```

### Filtering a record list by the selected category

Categories are attached to records through the `sys_category_record_mm` table. A minimal
constraint for a list query looks like this:

```php
$subQuery = $connectionPool->getQueryBuilderForTable('sys_category_record_mm');
$recordUids = $subQuery
    ->select('uid_foreign')
    ->from('sys_category_record_mm')
    ->where(
        $subQuery->expr()->eq('uid_local', $subQuery->createNamedParameter($categoryUid, Connection::PARAM_INT)),
        $subQuery->expr()->eq('tablenames', $subQuery->createNamedParameter('tx_myext_domain_model_report')),
        $subQuery->expr()->eq('fieldname', $subQuery->createNamedParameter('categories')),
    )
    ->executeQuery()
    ->fetchFirstColumn();
```

## The optional category management module

Enabled by default. It appears as **Web > Categories** and exists purely to manage the
tree: create, rename, move and delete categories via the tree, and edit the selected
category in the regular TYPO3 record form (`record_edit`). Closing the form returns to
the module.

Switch it off in the extension configuration (`enableCategoryModule = 0`) if you only
want the navigation component.

## Configuration

All settings live in the extension configuration
(**Admin Tools > Settings > Extension Configuration > category_tree**):

| Setting                | Default | Meaning                                                                                          |
|------------------------|---------|--------------------------------------------------------------------------------------------------|
| `entryPoints`          | *empty* | Comma-separated `sys_category` UIDs used as tree roots. Empty means all top-level categories.       |
| `showRootNode`         | `1`     | Render a synthetic root node above the entry points. Selecting it clears the category selection.    |
| `rootNodeLabel`        | *empty* | Label of that root node. Accepts an `LLL:` reference. Empty means "All categories".                  |
| `levelsToFetch`        | `2`     | Levels resolved per request; deeper levels load on demand.                                          |
| `showHiddenCategories` | `1`     | Include disabled `sys_category` records in the tree.                                                |
| `enableCategoryModule` | `1`     | Register the **Web > Categories** module.                                                           |

Entry points that do not exist are silently skipped, so a stale UID cannot empty the tree.

See [Documentation/EntryPoints.md](Documentation/EntryPoints.md) for resolving entry
points dynamically, and [Documentation/Events.md](Documentation/Events.md) for decorating
tree nodes with badges and labels.

## Permissions

Reading the tree is not permission filtered — like TYPO3's own category selector, every
backend user sees the category hierarchy. Writing is gated twice: the toolbar's
create/edit/delete affordances only appear when the user has `tables_modify` access to
`sys_category`, and every write goes through `DataHandler`, which enforces record level
access regardless of what the frontend allows.

## Development

The repository ships a DDEV setup with a complete TYPO3 installation, so a working backend
is three commands away:

```bash
ddev start
ddev composer install
ddev init-typo3
```

`ddev init-typo3` drops the database, installs TYPO3, creates a site and an admin user,
and imports the functional test fixtures as demo content — a small category tree with
nested, hidden and translated records. It prints the backend URL when it finishes.
Override the admin credentials with `TYPO3_SETUP_ADMIN_USERNAME` / `TYPO3_SETUP_ADMIN_PASSWORD`
if the defaults do not suit you. Re-run it any time you want a clean slate.

### Frontend build

```bash
npm install
npm run watch        # rebuild Resources/Public/JavaScript on change
npm run build        # minified production build
npm run tsc          # type check
```

The compiled JavaScript in `Resources/Public/JavaScript/` is committed, because TYPO3
serves it directly. CI fails if it is out of sync with the TypeScript source, so run
`npm run build` whenever you touch `Resources/Private/TypeScript`.

After rebuilding, run `ddev exec vendor/bin/typo3 cache:flush` **and** hard-reload the
backend (`Cmd/Ctrl + Shift + R`) — the browser caches the module under an unchanged URL and
will otherwise keep running the previous bundle.

### Quality gate

```bash
ddev composer sca              # php-cs-fixer, phpstan, editorconfig, xliff
ddev composer test:unit
ddev composer test:functional
```

PHPStan runs at level 7 with an empty baseline. Functional tests use
`typo3/testing-framework` and need database credentials that may create and drop
databases; `.ddev/config.yaml` provides them.

## Documentation

- [Entry points](Documentation/EntryPoints.md) — where the tree starts, and how to resolve
  it dynamically
- [Events](Documentation/Events.md) — decorating tree nodes
- [Migration](Documentation/Migration.md) — moving over from the
  `xima_typo3_recordlist` prototype

## Credits

Extracted from a prototype built inside `xima/xima-typo3-recordlist`, and modelled on
TYPO3's own page tree.
