<?php

declare(strict_types=1);

namespace MaikSchneider\CategoryTree\Service;

use MaikSchneider\CategoryTree\Configuration\CategoryTreeSettings;
use MaikSchneider\CategoryTree\Domain\Repository\CategoryTreeRepository;

/**
 * Resolves the category UIDs the tree starts from.
 *
 * The resolved settings of the request are the shipped source, so entry points follow the
 * extension configuration, the module registry and TSconfig. This class is a plain DI
 * service, so an integration can replace it with a decorator (Services.yaml) to derive
 * entry points from anything else without touching the controller — the settings carry the
 * module identifier for that. See Documentation/EntryPoints.md.
 */
class EntryPointResolver
{
    public function __construct(
        private readonly CategoryTreeRepository $repository,
    ) {
    }

    /**
     * Entry points that actually exist, in the configured order.
     * An empty array means "render all top-level categories".
     *
     * @return int[]
     */
    public function resolve(CategoryTreeSettings $settings): array
    {
        if ($settings->entryPoints === []) {
            return [];
        }

        return array_values(array_filter(
            $settings->entryPoints,
            fn (int $uid): bool => $this->repository->findByUid($uid, $settings->showHiddenCategories) !== null
        ));
    }
}
