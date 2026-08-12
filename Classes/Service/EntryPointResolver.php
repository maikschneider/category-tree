<?php

declare(strict_types=1);

namespace MaikSchneider\CategoryTree\Service;

use MaikSchneider\CategoryTree\Configuration\CategoryTreeConfiguration;
use MaikSchneider\CategoryTree\Domain\Repository\CategoryTreeRepository;

/**
 * Resolves the category UIDs the tree starts from.
 *
 * The extension configuration is the shipped source. This class is a plain DI service,
 * so an integration can replace it with a decorator (Services.yaml) to derive entry points
 * from anything else — TSconfig, the active module, a site setting — without touching the
 * controller. See Documentation/EntryPoints.md.
 */
class EntryPointResolver
{
    public function __construct(
        private readonly CategoryTreeConfiguration $configuration,
        private readonly CategoryTreeRepository $repository,
    ) {
    }

    /**
     * Entry points that actually exist, in the configured order.
     * An empty array means "render all top-level categories".
     *
     * @return int[]
     */
    public function resolve(): array
    {
        $configured = $this->configuration->getEntryPoints();
        if ($configured === []) {
            return [];
        }

        $includeHidden = $this->configuration->shouldShowHiddenCategories();

        return array_values(array_filter(
            $configured,
            fn (int $uid): bool => $this->repository->findByUid($uid, $includeHidden) !== null
        ));
    }
}
