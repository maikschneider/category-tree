<?php

declare(strict_types=1);

namespace MaikSchneider\CategoryTree\Configuration;

/**
 * The settings the tree runs with for one request.
 *
 * Resolved per module by {@see ModuleSettingsResolver}, so two modules can render the same
 * component with different entry points, depth or root node.
 */
final readonly class CategoryTreeSettings
{
    /**
     * @param int[] $entryPoints Category UIDs the tree starts from; empty means all top-level categories
     * @param string|null $module Identifier of the module the tree is rendered in, null outside a module
     */
    public function __construct(
        public array $entryPoints,
        public bool $showRootNode,
        public string $rootNodeLabel,
        public int $levelsToFetch,
        public bool $showHiddenCategories,
        public ?string $module = null,
    ) {
    }
}
