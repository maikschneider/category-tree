# Per-module settings

The extension configuration applies to every module that renders the tree. A module that
needs a different tree — its own entry points, no root node, another depth — overrides
those settings for itself.

Three layers are merged, each overriding the one before it:

```
extension configuration    installation-wide default
        ↓
module registry            the default a module ships in its own code
        ↓
User TSconfig              what an integrator sets per user or group
```

A setting that no layer touches keeps the value of the layer below, so a module overriding
`entryPoints` still follows the extension configuration for everything else.

Overridable settings: `entryPoints`, `excludeCategories`, `showRootNode`, `rootNodeLabel`,
`levelsToFetch`, `showHiddenCategories`. `enableCategoryModule` is not among them — it decides whether the
**Web > Categories** module is registered at all, long before any module runs.

## The module registry

Register the defaults of your module in your own `ext_localconf.php`, keyed by the module
identifier you used in `Configuration/Backend/Modules.php`:

```php
$GLOBALS['TYPO3_CONF_VARS']['EXTENSIONS']['category_tree']['modules']['myext_reports'] = [
    'entryPoints' => [12, 48],
    'excludeCategories' => [51],
    'showRootNode' => false,
    'rootNodeLabel' => 'LLL:EXT:my_ext/Resources/Private/Language/locallang_mod.xlf:tree.root',
    'levelsToFetch' => 3,
    'showHiddenCategories' => false,
];
```

`entryPoints` and `excludeCategories` accept an array of UIDs here, or the comma-separated
string the extension configuration uses.

## User TSconfig

The same settings, addressed as `mod.<module identifier>.categoryTree`:

```typoscript
mod.myext_reports.categoryTree {
  entryPoints = 12,48
  excludeCategories = 51
  showRootNode = 0
  levelsToFetch = 3
  showHiddenCategories = 0
}
```

This is the layer that wins, so an integrator can adapt a module to a customer, a user or a
group without touching the module's code. Ship your defaults through
`ExtensionManagementUtility::addUserTSConfig()` if you want them overridable this way from
the start.

## How the module is recognised

The tree endpoints are routes of their own and know nothing about the module that rendered
the navigation. The component therefore sends its module identifier once, when it fetches
its configuration, and receives the other endpoint URLs with the module baked in.

Because that identifier arrives from the client, it is only accepted for a module that
exists and that the backend user may enter. Anything else is ignored and the tree falls
back to the extension configuration.

## The "id" parameter

The backend treats `id` as a page uid, and its module menu prepends one to every module
that has a navigation component. A module navigated by categories has no page uid to put
there, so any `id` reaching such a module is wrong and would be refused with "You don't have
access to this page".

The extension therefore removes `id` from every module whose navigation component is the
category tree, redirecting once so the address bar is clean too. Do not use `id` for a
purpose of your own in such a module — read your state from `category` and from parameters
of your own naming, which the tree keeps intact when the selection changes.

## Settings in your own code

`MaikSchneider\CategoryTree\Configuration\ModuleSettingsResolver` resolves a
`CategoryTreeSettings` object from a request, and that object carries the module identifier
it was resolved for. `EntryPointResolver` receives it, which is what a decorator branches
on when entry points depend on more than static configuration — see
[EntryPoints.md](EntryPoints.md).
