<?php

declare(strict_types=1);

namespace MaikSchneider\CategoryTree\Domain\Repository;

use TYPO3\CMS\Core\Database\Connection;
use TYPO3\CMS\Core\Database\ConnectionPool;
use TYPO3\CMS\Core\Database\Query\Restriction\HiddenRestriction;

/**
 * Reads sys_category records and nests them into a tree.
 *
 * All queries operate on the default language; localised categories are resolved by
 * FormEngine, not by the navigation tree.
 */
class CategoryTreeRepository
{
    public const TABLE = 'sys_category';

    /**
     * @var array<int, array<string, mixed>>|null
     */
    private ?array $categoryCache = null;

    private ?bool $cachedIncludeHidden = null;

    public function __construct(private readonly ConnectionPool $connectionPool)
    {
    }

    /**
     * Builds the nested tree below the given entry points.
     *
     * @param int[] $entryPoints Category UIDs acting as tree roots. Empty means all top-level categories.
     * @return array<int, array<string, mixed>> Nested category rows, each with a "children" key
     */
    public function findTree(array $entryPoints = [], bool $includeHidden = true): array
    {
        $nested = $this->buildNestedMap($includeHidden);

        if ($entryPoints === []) {
            return array_values(array_filter(
                $nested,
                static fn (array $category): bool => (int)$category['parent'] === 0
            ));
        }

        $roots = [];
        foreach ($entryPoints as $entryPoint) {
            if (isset($nested[$entryPoint])) {
                $roots[] = $nested[$entryPoint];
            }
        }

        return $roots;
    }

    /**
     * Direct children of a single category, each with its own nested subtree.
     *
     * @return array<int, array<string, mixed>>
     */
    public function findChildren(int $parent, bool $includeHidden = true): array
    {
        $nested = $this->buildNestedMap($includeHidden);

        return $nested[$parent]['children'] ?? [];
    }

    /**
     * Category UIDs from the topmost ancestor down to (and including) the given category.
     *
     * @return int[]
     */
    public function findRootline(int $categoryUid, bool $includeHidden = true): array
    {
        $categories = $this->loadCategories($includeHidden);

        $rootline = [];
        $current = $categoryUid;
        // Guard against cyclic parent references in broken data
        $seen = [];
        while ($current > 0 && isset($categories[$current]) && !isset($seen[$current])) {
            $seen[$current] = true;
            array_unshift($rootline, $current);
            $current = (int)$categories[$current]['parent'];
        }

        return $rootline;
    }

    /**
     * UIDs of every category below the given one, deepest first, so a caller may delete
     * them in order without ever orphaning a record.
     *
     * @return int[]
     */
    public function findDescendantUids(int $categoryUid, bool $includeHidden = true): array
    {
        $childrenByParent = [];
        foreach ($this->loadCategories($includeHidden) as $uid => $category) {
            $childrenByParent[(int)$category['parent']][] = $uid;
        }

        $descendants = [];
        $queue = $childrenByParent[$categoryUid] ?? [];
        // Breadth first, so reversing the result yields the deepest level first. A cyclic
        // parent reference in broken data would otherwise loop forever.
        while ($queue !== []) {
            $uid = array_shift($queue);
            if (isset($descendants[$uid]) || $uid === $categoryUid) {
                continue;
            }
            $descendants[$uid] = true;
            $queue = array_merge($queue, $childrenByParent[$uid] ?? []);
        }

        return array_reverse(array_keys($descendants));
    }

    /**
     * @return array<string, mixed>|null
     */
    public function findByUid(int $categoryUid, bool $includeHidden = true): ?array
    {
        return $this->loadCategories($includeHidden)[$categoryUid] ?? null;
    }

    /**
     * Filters a nested tree down to the branches whose title matches the search term.
     * Ancestors of a match are kept so the match stays reachable.
     *
     * @param array<int, array<string, mixed>> $categories
     * @return array<int, array<string, mixed>>
     */
    public function filterTree(array $categories, string $searchTerm): array
    {
        $searchTerm = mb_strtolower(trim($searchTerm));
        if ($searchTerm === '') {
            return [];
        }

        $matched = [];
        foreach ($categories as $category) {
            $branch = $this->filterBranch($category, $searchTerm);
            if ($branch !== null) {
                $matched[] = $branch;
            }
        }

        return $matched;
    }

    /**
     * @param array<string, mixed> $category
     * @return array<string, mixed>|null
     */
    private function filterBranch(array $category, string $searchTerm): ?array
    {
        $matchedChildren = [];
        foreach ($category['children'] as $child) {
            $branch = $this->filterBranch($child, $searchTerm);
            if ($branch !== null) {
                $matchedChildren[] = $branch;
            }
        }

        $selfMatches = str_contains(mb_strtolower((string)($category['title'] ?? '')), $searchTerm);
        if (!$selfMatches && $matchedChildren === []) {
            return null;
        }

        $category['children'] = $matchedChildren;

        return $category;
    }

    /**
     * Category rows keyed by uid, each carrying its nested children.
     *
     * @return array<int, array<string, mixed>>
     */
    private function buildNestedMap(bool $includeHidden): array
    {
        $categories = $this->loadCategories($includeHidden);

        $map = [];
        foreach ($categories as $uid => $category) {
            $category['children'] = [];
            $map[$uid] = $category;
        }

        foreach ($map as &$category) {
            $parent = (int)$category['parent'];
            if ($parent !== 0 && isset($map[$parent])) {
                $map[$parent]['children'][] = &$category;
            }
        }
        unset($category);

        return $map;
    }

    /**
     * Flat category rows keyed by uid, ordered by parent and sorting.
     *
     * @return array<int, array<string, mixed>>
     */
    private function loadCategories(bool $includeHidden): array
    {
        if ($this->categoryCache !== null && $this->cachedIncludeHidden === $includeHidden) {
            return $this->categoryCache;
        }

        $queryBuilder = $this->connectionPool->getQueryBuilderForTable(self::TABLE);
        if ($includeHidden) {
            $queryBuilder->getRestrictions()->removeByType(HiddenRestriction::class);
        }

        $rows = $queryBuilder
            ->select('*')
            ->from(self::TABLE)
            ->where(
                $queryBuilder->expr()->eq(
                    'sys_language_uid',
                    $queryBuilder->createNamedParameter(0, Connection::PARAM_INT)
                )
            )
            ->orderBy('parent', 'ASC')
            ->addOrderBy('sorting', 'ASC')
            ->executeQuery()
            ->fetchAllAssociative();

        $categories = [];
        foreach ($rows as $row) {
            $categories[(int)$row['uid']] = $row;
        }

        $this->categoryCache = $categories;
        $this->cachedIncludeHidden = $includeHidden;

        return $categories;
    }
}
