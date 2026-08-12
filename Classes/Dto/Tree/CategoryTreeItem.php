<?php

declare(strict_types=1);

namespace MaikSchneider\CategoryTree\Dto\Tree;

use TYPO3\CMS\Backend\Dto\Tree\TreeItem;

/**
 * A single node of the category tree.
 *
 * Extends the generic TreeItem with the few fields the category tree actually needs:
 * the record type (for TCA types on sys_category), the storage pid (so newly created
 * children land next to their parent) and the sorting value.
 */
final readonly class CategoryTreeItem implements \JsonSerializable
{
    public function __construct(
        public TreeItem $item,
        public string $categoryType,
        public string $nameSourceField,
        public int $storagePid,
        public int $sorting,
    ) {
    }

    /**
     * @return array<string, mixed>
     */
    public function jsonSerialize(): array
    {
        return [
            'type' => 'CategoryTreeItem',
            ...$this->item->jsonSerialize(),
            'categoryType' => $this->categoryType,
            'nameSourceField' => $this->nameSourceField,
            'storagePid' => $this->storagePid,
            'sorting' => $this->sorting,
        ];
    }
}
