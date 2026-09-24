<?php

declare(strict_types=1);

namespace MaikSchneider\CategoryTree\Tests\Functional\Controller;

use MaikSchneider\CategoryTree\Controller\CategoryTreeController;
use PHPUnit\Framework\Attributes\Test;
use Psr\Http\Message\ResponseInterface;
use TYPO3\CMS\Core\Http\ServerRequest;
use TYPO3\CMS\Core\Localization\LanguageServiceFactory;
use TYPO3\TestingFramework\Core\Functional\FunctionalTestCase;

final class CategoryPermissionsTest extends FunctionalTestCase
{
    protected array $testExtensionsToLoad = [
        'maikschneider/category-tree',
    ];

    protected function setUp(): void
    {
        parent::setUp();
        $this->importCSVDataSet(__DIR__ . '/../Fixtures/be_users_category_perms.csv');
        $this->importCSVDataSet(__DIR__ . '/../Fixtures/sys_category.csv');
    }

    /**
     * @param array<string, mixed> $extensionConfiguration
     */
    private function createSubjectFor(int $backendUserUid, array $extensionConfiguration = []): CategoryTreeController
    {
        $backendUser = $this->setUpBackendUser($backendUserUid);
        $GLOBALS['LANG'] = $this->get(LanguageServiceFactory::class)->createFromUserPreferences($backendUser);
        $GLOBALS['TYPO3_CONF_VARS']['EXTENSIONS']['category_tree'] = $extensionConfiguration;

        return $this->get(CategoryTreeController::class);
    }

    /**
     * @return array<int|string, mixed>
     */
    private function decode(ResponseInterface $response): array
    {
        return json_decode((string)$response->getBody(), true, 512, JSON_THROW_ON_ERROR);
    }

    /**
     * @param array<string, string> $queryParams
     */
    private function request(array $queryParams = []): ServerRequest
    {
        return (new ServerRequest('https://example.com/typo3/ajax/category-tree/data'))
            ->withQueryParams($queryParams);
    }

    #[Test]
    public function aMountedCategoryBecomesTheRootOfTheTree(): void
    {
        $items = $this->decode($this->createSubjectFor(3)->fetchDataAction($this->request()));

        self::assertSame(['All categories', 'Apple', 'Granny Smith'], array_column($items, 'name'));
        self::assertSame('0', $items[1]['parentIdentifier']);
        self::assertSame(1, $items[1]['depth']);
    }

    #[Test]
    public function groupMountsApply(): void
    {
        $items = $this->decode($this->createSubjectFor(4)->fetchDataAction($this->request()));

        self::assertSame(['All categories', 'Vegetables', 'Carrot'], array_column($items, 'name'));
    }

    #[Test]
    public function aMountBelowAnotherMountIsNotRenderedTwice(): void
    {
        $items = $this->decode($this->createSubjectFor(5)->fetchDataAction($this->request()));

        self::assertSame(['All categories', 'Apple', 'Granny Smith'], array_column($items, 'name'));
    }

    #[Test]
    public function adminsIgnoreTheirMounts(): void
    {
        $names = array_column($this->decode($this->createSubjectFor(7)->fetchDataAction($this->request())), 'name');

        self::assertContains('Fruits', $names);
        self::assertContains('Vegetables', $names);
    }

    #[Test]
    public function usersWithoutMountsSeeEverything(): void
    {
        $names = array_column($this->decode($this->createSubjectFor(8)->fetchDataAction($this->request())), 'name');

        self::assertContains('Fruits', $names);
        self::assertContains('Vegetables', $names);
    }

    #[Test]
    public function anEntryPointAboveAMountIsReplacedByTheMount(): void
    {
        $items = $this->decode(
            $this->createSubjectFor(3, ['entryPoints' => '1'])->fetchDataAction($this->request())
        );

        self::assertSame(['All categories', 'Apple', 'Granny Smith'], array_column($items, 'name'));
    }

    #[Test]
    public function anEntryPointInsideAMountIsKept(): void
    {
        $items = $this->decode(
            $this->createSubjectFor(6, ['entryPoints' => '2'])->fetchDataAction($this->request())
        );

        self::assertSame(['All categories', 'Apple', 'Granny Smith'], array_column($items, 'name'));
    }

    #[Test]
    public function anEntryPointOutsideEveryMountLeavesAnEmptyTree(): void
    {
        $items = $this->decode(
            $this->createSubjectFor(3, ['entryPoints' => '5'])->fetchDataAction($this->request())
        );

        self::assertSame(['All categories'], array_column($items, 'name'));
        self::assertFalse($items[0]['hasChildren']);
    }

    #[Test]
    public function childrenOfAnUnmountedCategoryAreNotReturned(): void
    {
        $subject = $this->createSubjectFor(3);

        self::assertSame([], $this->decode($subject->fetchDataAction($this->request(['parent' => '1']))));
        self::assertSame(
            ['Granny Smith'],
            array_column($this->decode($subject->fetchDataAction($this->request(['parent' => '2']))), 'name')
        );
    }

    #[Test]
    public function searchStaysInsideTheMounts(): void
    {
        $subject = $this->createSubjectFor(3);

        self::assertSame([], $this->decode($subject->filterDataAction($this->request(['q' => 'banana']))));
        self::assertSame(
            ['Apple', 'Granny Smith'],
            array_column($this->decode($subject->filterDataAction($this->request(['q' => 'granny']))), 'name')
        );
    }

    #[Test]
    public function rootlineStartsAtTheMount(): void
    {
        $subject = $this->createSubjectFor(3);

        self::assertSame(
            ['rootline' => ['0', '2', '4']],
            $this->decode($subject->fetchRootlineAction($this->request(['identifier' => '4'])))
        );
        self::assertSame(
            ['rootline' => []],
            $this->decode($subject->fetchRootlineAction($this->request(['identifier' => '3'])))
        );
    }

    #[Test]
    public function descendantsOfAnUnmountedCategoryAreNotReturned(): void
    {
        $subject = $this->createSubjectFor(3);

        self::assertSame(
            ['descendants' => []],
            $this->decode($subject->fetchDescendantsAction($this->request(['identifier' => '1'])))
        );
        self::assertSame(
            ['descendants' => ['4']],
            $this->decode($subject->fetchDescendantsAction($this->request(['identifier' => '2'])))
        );
    }
}
