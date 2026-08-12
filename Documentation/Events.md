# Events

## AfterCategoryTreeItemsPreparedEvent

Fired right before the tree items are serialised to JSON, for both the data and the filter
endpoint. Listeners receive the flat item arrays and may add, remove, reorder or decorate
them.

```php
<?php

namespace MyVendor\MyExt\EventListener;

use MaikSchneider\CategoryTree\Event\AfterCategoryTreeItemsPreparedEvent;
use TYPO3\CMS\Core\Attribute\AsEventListener;
use TYPO3\CMS\Core\Database\ConnectionPool;
use TYPO3\CMS\Core\Utility\MathUtility;

#[AsEventListener]
final class AddVisibilityBadges
{
    public function __construct(private readonly ConnectionPool $connectionPool) {}

    public function __invoke(AfterCategoryTreeItemsPreparedEvent $event): void
    {
        $items = $event->getItems();
        $visibility = $this->loadVisibilityFlags();

        foreach ($items as &$item) {
            if (!MathUtility::canBeInterpretedAsInteger($item['identifier'] ?? null)) {
                continue;
            }
            if (($visibility[(int)$item['identifier']] ?? null) !== 'internal') {
                continue;
            }
            $item['statusInformation'][] = [
                'icon' => 'actions-lock',
                'label' => 'Internal',
                'severity' => 0,
                'priority' => 1,
            ];
        }
        unset($item);

        $event->setItems($items);
    }
}
```

### Item keys

| Key                 | Type     | Notes                                                                 |
|---------------------|----------|-----------------------------------------------------------------------|
| `identifier`        | `string` | Category UID, or `0` for the synthetic root node                       |
| `parentIdentifier`  | `string` | Empty for root-level nodes                                             |
| `recordType`        | `string` | Always `sys_category`                                                  |
| `name`              | `string` | Raw title — escaped when rendered, do not escape it here               |
| `depth`             | `int`    | Nesting level within the payload                                       |
| `icon`              | `string` | Icon identifier                                                        |
| `overlayIcon`       | `string` | Icon identifier or empty                                               |
| `editable`          | `bool`   | Reflects `tables_modify` access                                        |
| `deletable`         | `bool`   | Reflects `tables_modify` access                                        |
| `hasChildren`       | `bool`   |                                                                        |
| `loaded`            | `bool`   | Whether the children are part of this payload                          |
| `categoryType`      | `int`    | Value of the TCA type field, `0` when `sys_category` has none          |
| `storagePid`        | `int`    | The record's pid; new children are created there                       |
| `sorting`           | `int`    |                                                                        |
| `statusInformation` | `array`  | Badges: `icon`, `label`, `severity`, `priority`                        |
| `labels`            | `array`  | Coloured labels: `label`, `color`, `priority`                          |

Keys the DTO does not know are dropped during serialisation, so adding arbitrary fields
will not reach the client — extend `statusInformation` or `labels` instead.

Removing items from the payload hides them from the tree, but it does not restrict access:
the record itself stays reachable through other backend modules.
