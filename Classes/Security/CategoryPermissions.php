<?php

declare(strict_types=1);

namespace MaikSchneider\CategoryTree\Security;

use MaikSchneider\CategoryTree\Domain\Repository\CategoryTreeRepository;
use TYPO3\CMS\Core\Authentication\BackendUserAuthentication;

/**
 * Applies the category mounts of a backend user ("category_perms" of the user and its
 * groups) to the tree, the way core restricts its own category selector.
 *
 * A user without mounts, and every admin, is unrestricted. Otherwise only the mounted
 * categories and everything below them are reachable. Ancestry is always evaluated on the
 * full hierarchy, so hiding or excluding a category never widens or narrows access.
 */
class CategoryPermissions
{
    public function __construct(private readonly CategoryTreeRepository $repository)
    {
    }

    /**
     * Mounted category UIDs that exist, in the order the user and its groups list them.
     * Null means the user is not restricted at all.
     *
     * @return int[]|null
     */
    public function getMountPoints(): ?array
    {
        $backendUser = $this->getBackendUser();
        if ($backendUser === null || $backendUser->isAdmin()) {
            return null;
        }

        $mountPoints = array_values(array_unique(array_filter(
            array_map(intval(...), $backendUser->getCategoryMountPoints()),
            static fn (int $uid): bool => $uid > 0
        )));
        if ($mountPoints === []) {
            return null;
        }

        return array_values(array_filter(
            $mountPoints,
            fn (int $uid): bool => $this->repository->findByUid($uid) !== null
        ));
    }

    public function isAccessible(int $categoryUid): bool
    {
        $mountPoints = $this->getMountPoints();
        if ($mountPoints === null) {
            return true;
        }

        return array_intersect($this->repository->findRootline($categoryUid), $mountPoints) !== [];
    }

    /**
     * Narrows the configured entry points to what the user may see. An entry point inside a
     * mount stays; an entry point above a mount is replaced by the mounts below it. Without
     * entry points the mounts themselves become the roots.
     *
     * Null means no restriction applies and the entry points stand as they are. An empty
     * array means the user may see nothing — unlike an empty entry point list, which means
     * "all top-level categories".
     *
     * @param int[] $entryPoints
     * @return int[]|null
     */
    public function restrictEntryPoints(array $entryPoints): ?array
    {
        $mountPoints = $this->getMountPoints();
        if ($mountPoints === null) {
            return null;
        }

        if ($entryPoints === []) {
            return $this->withoutNestedRoots($mountPoints);
        }

        $roots = [];
        foreach ($entryPoints as $entryPoint) {
            if ($this->isAccessible($entryPoint)) {
                $roots[] = $entryPoint;
                continue;
            }
            foreach ($mountPoints as $mountPoint) {
                if (in_array($entryPoint, $this->repository->findRootline($mountPoint), true)) {
                    $roots[] = $mountPoint;
                }
            }
        }

        return $this->withoutNestedRoots(array_values(array_unique($roots)));
    }

    /**
     * The part of a rootline the user may see: everything from the topmost mount down.
     *
     * @param int[] $rootline
     * @return int[]
     */
    public function restrictRootline(array $rootline): array
    {
        $mountPoints = $this->getMountPoints();
        if ($mountPoints === null) {
            return $rootline;
        }

        foreach ($rootline as $index => $uid) {
            if (in_array($uid, $mountPoints, true)) {
                return array_slice($rootline, $index);
            }
        }

        return [];
    }

    /**
     * A root that lies below another root would render its branch twice.
     *
     * @param int[] $roots
     * @return int[]
     */
    private function withoutNestedRoots(array $roots): array
    {
        return array_values(array_filter(
            $roots,
            function (int $root) use ($roots): bool {
                $ancestors = array_slice($this->repository->findRootline($root), 0, -1);

                return array_intersect($ancestors, $roots) === [];
            }
        ));
    }

    private function getBackendUser(): ?BackendUserAuthentication
    {
        return $GLOBALS['BE_USER'] ?? null;
    }
}
