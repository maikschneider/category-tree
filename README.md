# Category Tree

A reusable **category tree navigation component** for TYPO3 backend modules — plus an
optional backend module for managing categories.

Any backend module can declare the tree as its navigation component. Selecting a node
reloads the module with a `category=<uid>` query parameter; what the module does with that
is entirely up to the module. The tree itself handles creating, renaming, moving, copying,
deleting and searching `sys_category` records.

- **TYPO3**: 13.4 LTS and 14.3 LTS
- **PHP**: 8.2+
- **License**: GPL-2.0-or-later

## Installation

```bash
composer require maikschneider/category-tree
```

## Using the tree in your own module

Declare it as the `navigationComponent` of your module in
`Configuration/Backend/Modules.php`:

```php
return [
    'myext_reports' => [
        'parent' => 'web',
        'access' => 'user',
        'labels' => 'LLL:EXT:my_ext/Resources/Private/Language/locallang_mod.xlf',
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
tree nodes.

## Permissions

Reading the tree is not permission filtered — like TYPO3's own category selector, every
backend user sees the category hierarchy. Writing is gated twice: the toolbar's
create/edit/delete affordances only appear when the user has `tables_modify` access to
`sys_category`, and every write goes through `DataHandler`, which enforces record level
access regardless of what the frontend allows.

## Development

```bash
npm install          # once
npm run watch        # rebuild Resources/Public/JavaScript on change
npm run build        # minified production build
composer sca         # php-cs-fixer, phpstan, editorconfig, xliff
composer test:unit
composer test:functional
```

The compiled JavaScript in `Resources/Public/JavaScript/` is committed, because TYPO3
serves it directly. Rebuild it whenever the TypeScript changes.
