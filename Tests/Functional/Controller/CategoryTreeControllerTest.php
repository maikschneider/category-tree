<?php

declare(strict_types=1);

namespace MaikSchneider\CategoryTree\Tests\Functional\Controller;

use MaikSchneider\CategoryTree\Controller\CategoryTreeController;
use PHPUnit\Framework\Attributes\Test;
use Psr\Http\Message\ResponseInterface;
use TYPO3\CMS\Core\Http\ServerRequest;
use TYPO3\CMS\Core\Localization\LanguageServiceFactory;
use TYPO3\TestingFramework\Core\Functional\FunctionalTestCase;

final class CategoryTreeControllerTest extends FunctionalTestCase
{
    protected array $testExtensionsToLoad = [
        'maikschneider/category-tree',
    ];

    protected function setUp(): void
    {
        parent::setUp();
        $this->importCSVDataSet(__DIR__ . '/../Fixtures/be_users.csv');
        $this->importCSVDataSet(__DIR__ . '/../Fixtures/sys_category.csv');
        $backendUser = $this->setUpBackendUser(1);
        $GLOBALS['LANG'] = $this->get(LanguageServiceFactory::class)->createFromUserPreferences($backendUser);
    }

    /**
     * @param array<string, mixed> $extensionConfiguration
     */
    private function createSubject(array $extensionConfiguration = []): CategoryTreeController
    {
        $GLOBALS['TYPO3_CONF_VARS']['EXTENSIONS']['category_tree'] = $extensionConfiguration;

        return $this->get(CategoryTreeController::class);
    }

    /**
     * @return array<int, array<string, mixed>>
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
    public function rootRequestReturnsTheSyntheticRootFollowedByTopLevelCategories(): void
    {
        $items = $this->decode($this->createSubject()->fetchDataAction($this->request()));

        self::assertSame('0', $items[0]['identifier']);
        self::assertSame('All categories', $items[0]['name']);
        self::assertSame('', $items[0]['parentIdentifier']);
        self::assertSame(0, $items[0]['depth']);
        self::assertTrue($items[0]['hasChildren']);

        self::assertSame('Fruits', $items[1]['name']);
        self::assertSame('0', $items[1]['parentIdentifier']);
        self::assertSame(1, $items[1]['depth']);
    }

    #[Test]
    public function rootRequestOmitsTheSyntheticRootWhenDisabled(): void
    {
        $items = $this->decode(
            $this->createSubject(['showRootNode' => '0'])->fetchDataAction($this->request())
        );

        self::assertSame('Fruits', $items[0]['name']);
        self::assertSame('', $items[0]['parentIdentifier']);
        self::assertSame(0, $items[0]['depth']);
    }

    #[Test]
    public function levelsToFetchLimitsHowDeepTheFirstPayloadGoes(): void
    {
        // Root node + Fruits, Apple, Banana, Vegetables, Carrot — but not Granny Smith (depth 3)
        $items = $this->decode($this->createSubject()->fetchDataAction($this->request()));

        self::assertNotContains('Granny Smith', array_column($items, 'name'));

        $apple = $this->itemByName($items, 'Apple');
        self::assertTrue($apple['hasChildren']);
        self::assertFalse($apple['loaded']);
    }

    #[Test]
    public function raisingLevelsToFetchIncludesDeeperNodes(): void
    {
        $items = $this->decode(
            $this->createSubject(['levelsToFetch' => '3'])->fetchDataAction($this->request())
        );

        self::assertContains('Granny Smith', array_column($items, 'name'));
        self::assertTrue($this->itemByName($items, 'Apple')['loaded']);
    }

    #[Test]
    public function leafNodesAreMarkedAsLoaded(): void
    {
        $items = $this->decode($this->createSubject()->fetchDataAction($this->request()));

        self::assertTrue($this->itemByName($items, 'Banana')['loaded']);
        self::assertFalse($this->itemByName($items, 'Banana')['hasChildren']);
    }

    #[Test]
    public function anEntryPointBecomesTheRootAndIsReparented(): void
    {
        $items = $this->decode(
            $this->createSubject(['entryPoints' => '2'])->fetchDataAction($this->request())
        );

        self::assertSame('0', $items[0]['identifier']);
        // Apple's real parent is 1, but 1 is not part of the payload
        self::assertSame('Apple', $items[1]['name']);
        self::assertSame('0', $items[1]['parentIdentifier']);
        self::assertSame(1, $items[1]['depth']);
        self::assertSame('Granny Smith', $items[2]['name']);
        self::assertSame('2', $items[2]['parentIdentifier']);
    }

    #[Test]
    public function childRequestReturnsChildrenAtTheNextDepth(): void
    {
        $items = $this->decode(
            $this->createSubject()->fetchDataAction($this->request(['parent' => '2', 'depth' => '2']))
        );

        self::assertSame(['Granny Smith'], array_column($items, 'name'));
        self::assertSame(3, $items[0]['depth']);
        self::assertSame('2', $items[0]['parentIdentifier']);
    }

    #[Test]
    public function hiddenCategoriesCanBeExcluded(): void
    {
        $items = $this->decode(
            $this->createSubject(['showHiddenCategories' => '0'])->fetchDataAction($this->request())
        );

        self::assertNotContains('Carrot', array_column($items, 'name'));
    }

    #[Test]
    public function itemsCarryTheCategoryTreeItemShape(): void
    {
        $items = $this->decode($this->createSubject()->fetchDataAction($this->request()));
        $fruits = $this->itemByName($items, 'Fruits');

        self::assertSame('CategoryTreeItem', $fruits['type']);
        self::assertSame('sys_category', $fruits['recordType']);
        self::assertSame(1, $fruits['storagePid']);
        self::assertSame(256, $fruits['sorting']);
        self::assertArrayHasKey('categoryType', $fruits);
        self::assertArrayNotHasKey('doktype', $fruits);
        self::assertArrayNotHasKey('mountPoint', $fruits);
    }

    #[Test]
    public function adminUsersMayEditAndDeleteNodes(): void
    {
        $items = $this->decode($this->createSubject()->fetchDataAction($this->request()));
        $fruits = $this->itemByName($items, 'Fruits');

        self::assertTrue($fruits['editable']);
        self::assertTrue($fruits['deletable']);
    }

    #[Test]
    public function filterReturnsTheMatchingBranchFullyExpanded(): void
    {
        $items = $this->decode(
            $this->createSubject()->filterDataAction($this->request(['q' => 'granny']))
        );

        self::assertSame(['Fruits', 'Apple', 'Granny Smith'], array_column($items, 'name'));
        self::assertSame([0, 1, 2], array_column($items, 'depth'));
        self::assertSame('', $items[0]['parentIdentifier']);
    }

    #[Test]
    public function filterWithoutSearchTermReturnsNothing(): void
    {
        self::assertSame(
            [],
            $this->decode($this->createSubject()->filterDataAction($this->request(['q' => ''])))
        );
    }

    #[Test]
    public function rootlineIncludesTheSyntheticRootWhenEnabled(): void
    {
        $response = $this->createSubject()->fetchRootlineAction($this->request(['identifier' => '4']));

        self::assertSame(
            ['rootline' => ['0', '1', '2', '4']],
            json_decode((string)$response->getBody(), true, 512, JSON_THROW_ON_ERROR)
        );
    }

    #[Test]
    public function rootlineOmitsTheSyntheticRootWhenDisabled(): void
    {
        $response = $this->createSubject(['showRootNode' => '0'])
            ->fetchRootlineAction($this->request(['identifier' => '4']));

        self::assertSame(
            ['rootline' => ['1', '2', '4']],
            json_decode((string)$response->getBody(), true, 512, JSON_THROW_ON_ERROR)
        );
    }

    #[Test]
    public function rootlineIsEmptyForANonNumericIdentifier(): void
    {
        $response = $this->createSubject()->fetchRootlineAction($this->request(['identifier' => 'nope']));

        self::assertSame(
            ['rootline' => []],
            json_decode((string)$response->getBody(), true, 512, JSON_THROW_ON_ERROR)
        );
    }

    #[Test]
    public function excludedCategoriesAreMissingFromTheTree(): void
    {
        $items = $this->decode(
            $this->createSubject(['excludeCategories' => '2'])->fetchDataAction($this->request())
        );
        $names = array_column($items, 'name');

        self::assertContains('Fruits', $names);
        self::assertNotContains('Apple', $names);
        self::assertNotContains('Granny Smith', $names);
    }

    #[Test]
    public function excludedCategoriesAreMissingFromASearch(): void
    {
        $items = $this->decode(
            $this->createSubject(['excludeCategories' => '2'])->filterDataAction($this->request(['q' => 'granny']))
        );

        self::assertSame([], $items);
    }

    #[Test]
    public function descendantsReturnTheBranchBelowACategory(): void
    {
        $response = $this->createSubject()->fetchDescendantsAction($this->request(['identifier' => '1']));

        self::assertSame(
            ['descendants' => ['4', '3', '2']],
            json_decode((string)$response->getBody(), true, 512, JSON_THROW_ON_ERROR)
        );
    }

    #[Test]
    public function descendantsAreEmptyForANonNumericIdentifier(): void
    {
        $response = $this->createSubject()->fetchDescendantsAction($this->request(['identifier' => 'nope']));

        self::assertSame(
            ['descendants' => []],
            json_decode((string)$response->getBody(), true, 512, JSON_THROW_ON_ERROR)
        );
    }

    #[Test]
    public function configurationExposesTheAjaxEndpointsAndWritePermission(): void
    {
        $configuration = json_decode(
            (string)$this->createSubject()->fetchConfigurationAction($this->request())->getBody(),
            true,
            512,
            JSON_THROW_ON_ERROR
        );

        self::assertTrue($configuration['canModify']);
        self::assertStringContainsString('category-tree/data', $configuration['dataUrl']);
        self::assertStringContainsString('category-tree/filter', $configuration['filterUrl']);
        self::assertStringContainsString('category-tree/rootline', $configuration['rootlineUrl']);
        self::assertNotSame([], $configuration['categoryTypes']);
    }

    #[Test]
    public function configurationKeepsNonNumericTypeValuesIntact(): void
    {
        $GLOBALS['TCA']['sys_category']['ctrl']['type'] = 'record_type';
        $GLOBALS['TCA']['sys_category']['columns']['record_type']['config'] = [
            'type' => 'select',
            'renderType' => 'selectSingle',
            'items' => [
                ['label' => 'Default', 'value' => '0'],
                ['label' => 'Department', 'value' => 'department'],
            ],
        ];

        $configuration = json_decode(
            (string)$this->createSubject()->fetchConfigurationAction($this->request())->getBody(),
            true,
            512,
            JSON_THROW_ON_ERROR
        );

        self::assertSame('record_type', $configuration['typeField']);
        self::assertSame(['0', 'department'], array_column($configuration['categoryTypes'], 'nodeType'));
    }

    /**
     * @param array<int, array<string, mixed>> $items
     * @return array<string, mixed>
     */
    private function itemByName(array $items, string $name): array
    {
        foreach ($items as $item) {
            if ($item['name'] === $name) {
                return $item;
            }
        }

        self::fail(sprintf('No tree item named "%s" in the payload.', $name));
    }
}
