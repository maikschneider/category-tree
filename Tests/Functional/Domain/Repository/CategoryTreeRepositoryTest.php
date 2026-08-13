<?php

declare(strict_types=1);

namespace MaikSchneider\CategoryTree\Tests\Functional\Domain\Repository;

use MaikSchneider\CategoryTree\Domain\Repository\CategoryTreeRepository;
use PHPUnit\Framework\Attributes\Test;
use TYPO3\TestingFramework\Core\Functional\FunctionalTestCase;

final class CategoryTreeRepositoryTest extends FunctionalTestCase
{
    protected array $testExtensionsToLoad = [
        'maikschneider/category-tree',
    ];

    private CategoryTreeRepository $subject;

    protected function setUp(): void
    {
        parent::setUp();
        $this->importCSVDataSet(__DIR__ . '/../../Fixtures/sys_category.csv');
        $this->subject = $this->get(CategoryTreeRepository::class);
    }

    #[Test]
    public function findTreeReturnsTopLevelCategoriesNestedAndSorted(): void
    {
        $tree = $this->subject->findTree();

        self::assertSame(['Fruits', 'Vegetables'], array_column($tree, 'title'));
        self::assertSame(['Apple', 'Banana'], array_column($tree[0]['children'], 'title'));
        self::assertSame(['Granny Smith'], array_column($tree[0]['children'][0]['children'], 'title'));
    }

    #[Test]
    public function findTreeLeavesOutExcludedCategoriesWithTheirBranch(): void
    {
        $tree = $this->subject->findTree(includeHidden: true, excluded: [2]);

        self::assertSame(['Fruits', 'Vegetables'], array_column($tree, 'title'));
        // Apple is excluded, and Granny Smith below it goes with it.
        self::assertSame(['Banana'], array_column($tree[0]['children'], 'title'));
    }

    #[Test]
    public function findTreeCanExcludeATopLevelCategory(): void
    {
        $tree = $this->subject->findTree(includeHidden: true, excluded: [1]);

        self::assertSame(['Vegetables'], array_column($tree, 'title'));
    }

    #[Test]
    public function findChildrenLeavesOutExcludedCategories(): void
    {
        $children = $this->subject->findChildren(1, true, [3]);

        self::assertSame(['Apple'], array_column($children, 'title'));
    }

    #[Test]
    public function findByUidDoesNotResolveAnExcludedCategory(): void
    {
        self::assertNull($this->subject->findByUid(2, true, [2]));
        self::assertNotNull($this->subject->findByUid(2));
    }

    #[Test]
    public function findRootlineStopsAtAnExcludedAncestor(): void
    {
        // Granny Smith is still there, but its way up ends where Apple was removed.
        self::assertSame([4], $this->subject->findRootline(4, true, [2]));
    }

    #[Test]
    public function findDescendantUidsReturnsTheWholeBranchDeepestFirst(): void
    {
        self::assertSame([4, 3, 2], $this->subject->findDescendantUids(1));
    }

    #[Test]
    public function findDescendantUidsIncludesHiddenCategories(): void
    {
        // Carrot is hidden; leaving it out would orphan it when its parent is deleted.
        self::assertSame([6], $this->subject->findDescendantUids(5));
    }

    #[Test]
    public function findDescendantUidsIsEmptyForALeaf(): void
    {
        self::assertSame([], $this->subject->findDescendantUids(4));
    }

    #[Test]
    public function findTreeExcludesDeletedAndTranslatedRecords(): void
    {
        $titles = array_column($this->subject->findTree(), 'title');

        self::assertNotContains('Removed', $titles);
        self::assertNotContains('Frucht', $titles);
    }

    #[Test]
    public function findTreeIncludesHiddenCategoriesByDefault(): void
    {
        $vegetables = $this->subject->findTree()[1];

        self::assertSame(['Carrot'], array_column($vegetables['children'], 'title'));
    }

    #[Test]
    public function findTreeOmitsHiddenCategoriesWhenRequested(): void
    {
        $tree = $this->subject->findTree([], false);
        $vegetables = $tree[1];

        self::assertSame([], $vegetables['children']);
    }

    #[Test]
    public function findTreeStartsAtTheGivenEntryPoints(): void
    {
        $tree = $this->subject->findTree([2]);

        self::assertSame(['Apple'], array_column($tree, 'title'));
        self::assertSame(['Granny Smith'], array_column($tree[0]['children'], 'title'));
    }

    #[Test]
    public function findTreeSkipsEntryPointsThatDoNotExist(): void
    {
        $tree = $this->subject->findTree([2, 9999]);

        self::assertSame(['Apple'], array_column($tree, 'title'));
    }

    #[Test]
    public function findTreeKeepsTheConfiguredEntryPointOrder(): void
    {
        $tree = $this->subject->findTree([5, 1]);

        self::assertSame(['Vegetables', 'Fruits'], array_column($tree, 'title'));
    }

    #[Test]
    public function findChildrenReturnsDirectChildrenWithTheirSubtree(): void
    {
        $children = $this->subject->findChildren(1);

        self::assertSame(['Apple', 'Banana'], array_column($children, 'title'));
        self::assertSame(['Granny Smith'], array_column($children[0]['children'], 'title'));
    }

    #[Test]
    public function findChildrenReturnsEmptyArrayForUnknownParent(): void
    {
        self::assertSame([], $this->subject->findChildren(9999));
    }

    #[Test]
    public function findRootlineReturnsAncestorsTopDownIncludingTheCategoryItself(): void
    {
        self::assertSame([1, 2, 4], $this->subject->findRootline(4));
    }

    #[Test]
    public function findRootlineReturnsEmptyArrayForUnknownCategory(): void
    {
        self::assertSame([], $this->subject->findRootline(9999));
    }

    #[Test]
    public function findByUidReturnsNullForDeletedCategory(): void
    {
        self::assertNull($this->subject->findByUid(7));
    }

    #[Test]
    public function filterTreeKeepsMatchingBranchesAndTheirAncestors(): void
    {
        $matched = $this->subject->filterTree($this->subject->findTree(), 'granny');

        self::assertSame(['Fruits'], array_column($matched, 'title'));
        self::assertSame(['Apple'], array_column($matched[0]['children'], 'title'));
        self::assertSame(['Granny Smith'], array_column($matched[0]['children'][0]['children'], 'title'));
    }

    #[Test]
    public function filterTreeIsCaseInsensitiveAndMultibyteAware(): void
    {
        $this->getConnectionPool()
            ->getConnectionForTable('sys_category')
            ->update('sys_category', ['title' => 'Äpfel'], ['uid' => 2]);

        $matched = $this->subject->filterTree($this->subject->findTree(), 'äPFel');

        self::assertSame(['Äpfel'], array_column($matched[0]['children'], 'title'));
    }

    #[Test]
    public function filterTreeReturnsNothingForABlankSearchTerm(): void
    {
        self::assertSame([], $this->subject->filterTree($this->subject->findTree(), '   '));
    }
}
