# Entry points

The entry point decides where the tree starts. Without one, the tree renders every
top-level category (`parent = 0`).

## Configuring it

Set `entryPoints` in the extension configuration to a comma-separated list of
`sys_category` UIDs. A single module can override this for itself, see
[ModuleSettings.md](ModuleSettings.md):

```
entryPoints = 12,48
```

Each UID becomes a root of the tree. UIDs that do not resolve to an existing category are
dropped, so a deleted category cannot blank out the navigation.

## Leaving categories out

`excludeCategories` is the counterpart: a comma-separated list of UIDs that never appear in
the tree, together with everything below them.

```
excludeCategories = 51
```

An excluded category is dropped before the hierarchy is built, so its children are attached
to nothing and the whole branch disappears — from the tree, from a search and from the
rootline. The records themselves are untouched, and a module can exclude a different set,
see [ModuleSettings.md](ModuleSettings.md).

With `showRootNode = 1` (the default) a synthetic node is rendered above the entry points.
Its identifier is `0`, and selecting it removes the `category` parameter from the module
URL — the module's cue that no category is selected.

## Resolving entry points dynamically

`MaikSchneider\CategoryTree\Service\EntryPointResolver` is an ordinary DI service and the
single place entry points are decided. It receives the settings resolved for the request,
which carry the entry points of the three configuration layers and the module they were
resolved for. Decorate it when static configuration is not enough — for example to derive
the entry point from the backend user's group, a site setting, or the state of another
record.

`Configuration/Services.yaml` in your own extension:

```yaml
services:
  MyVendor\MyExt\CategoryTree\ModuleAwareEntryPointResolver:
    decorates: MaikSchneider\CategoryTree\Service\EntryPointResolver
    arguments:
      $inner: '@.inner'
```

```php
<?php

namespace MyVendor\MyExt\CategoryTree;

use MaikSchneider\CategoryTree\Configuration\CategoryTreeSettings;
use MaikSchneider\CategoryTree\Service\EntryPointResolver;

final class GroupAwareEntryPointResolver extends EntryPointResolver
{
    public function __construct(private readonly EntryPointResolver $inner) {}

    public function resolve(CategoryTreeSettings $settings): array
    {
        if ($settings->module === 'myext_products' && !$GLOBALS['BE_USER']->isAdmin()) {
            return [12];
        }

        return $this->inner->resolve($settings);
    }
}
```

Static per-module entry points need no PHP at all — put them in the module registry or in
TSconfig, see [ModuleSettings.md](ModuleSettings.md).

The resolver is consulted on every data and filter request, so the tree follows whatever
the decorator returns without any client-side state.

## What the resolver must return

An array of integer category UIDs, in the order they should appear. An empty array means
"all top-level categories". The controller re-parents whatever comes back to the synthetic
root node (or to no parent at all), so an entry point may sit at any depth of the real
category hierarchy.
