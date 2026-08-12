# Entry points

The entry point decides where the tree starts. Without one, the tree renders every
top-level category (`parent = 0`).

## Configuring it

Set `entryPoints` in the extension configuration to a comma-separated list of
`sys_category` UIDs:

```
entryPoints = 12,48
```

Each UID becomes a root of the tree. UIDs that do not resolve to an existing category are
dropped, so a deleted category cannot blank out the navigation.

With `showRootNode = 1` (the default) a synthetic node is rendered above the entry points.
Its identifier is `0`, and selecting it removes the `category` parameter from the module
URL — the module's cue that no category is selected.

## Resolving entry points dynamically

`MaikSchneider\CategoryTree\Service\EntryPointResolver` is an ordinary DI service and the
single place entry points are decided. Decorate it when the static setting is not enough —
for example to derive the entry point from the active module, the backend user's group, or
a site setting.

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

use MaikSchneider\CategoryTree\Service\EntryPointResolver;
use TYPO3\CMS\Core\Http\ServerRequest;

final class ModuleAwareEntryPointResolver extends EntryPointResolver
{
    public function __construct(private readonly EntryPointResolver $inner) {}

    public function resolve(): array
    {
        $module = $GLOBALS['TYPO3_REQUEST']?->getAttribute('module')?->getIdentifier();

        return match ($module) {
            'myext_products' => [12],
            'myext_downloads' => [48],
            default => $this->inner->resolve(),
        };
    }
}
```

The resolver is consulted on every data and filter request, so the tree follows whatever
the decorator returns without any client-side state.

## What the resolver must return

An array of integer category UIDs, in the order they should appear. An empty array means
"all top-level categories". The controller re-parents whatever comes back to the synthetic
root node (or to no parent at all), so an entry point may sit at any depth of the real
category hierarchy.
