<?php

declare(strict_types=1);

namespace MaikSchneider\CategoryTree\Tests\Functional\Configuration;

use MaikSchneider\CategoryTree\Configuration\CategoryTreeSettings;
use MaikSchneider\CategoryTree\Configuration\ModuleSettingsResolver;
use MaikSchneider\CategoryTree\Controller\CategoryModuleController;
use PHPUnit\Framework\Attributes\Test;
use TYPO3\CMS\Core\Http\ServerRequest;
use TYPO3\TestingFramework\Core\Functional\FunctionalTestCase;

final class ModuleSettingsResolverTest extends FunctionalTestCase
{
    protected array $testExtensionsToLoad = [
        'maikschneider/category-tree',
    ];

    private const MODULE = CategoryModuleController::MODULE_IDENTIFIER;

    protected function setUp(): void
    {
        parent::setUp();
        $this->importCSVDataSet(__DIR__ . '/../Fixtures/be_users.csv');
        $this->importCSVDataSet(__DIR__ . '/../Fixtures/be_users_tsconfig.csv');
    }

    /**
     * @param array<string, mixed> $extensionConfiguration
     * @param array<string, array<string, mixed>> $moduleRegistry
     */
    private function resolve(
        ?string $module,
        array $extensionConfiguration = [],
        array $moduleRegistry = [],
        int $backendUserUid = 1
    ): CategoryTreeSettings {
        $this->setUpBackendUser($backendUserUid);
        $GLOBALS['TYPO3_CONF_VARS']['EXTENSIONS']['category_tree'] = $extensionConfiguration + ['modules' => $moduleRegistry];

        $request = (new ServerRequest('https://example.com/typo3/ajax/category-tree/data'))
            ->withQueryParams($module === null ? [] : ['module' => $module]);

        return $this->get(ModuleSettingsResolver::class)->resolve($request);
    }

    #[Test]
    public function fallsBackToTheExtensionConfigurationWithoutAModule(): void
    {
        $settings = $this->resolve(null, ['entryPoints' => '1,5', 'levelsToFetch' => 3]);

        self::assertNull($settings->module);
        self::assertSame([1, 5], $settings->entryPoints);
        self::assertSame(3, $settings->levelsToFetch);
    }

    #[Test]
    public function theModuleRegistryOverridesTheExtensionConfiguration(): void
    {
        $settings = $this->resolve(
            self::MODULE,
            ['entryPoints' => '1,5', 'levelsToFetch' => 3, 'showRootNode' => 1],
            [self::MODULE => ['entryPoints' => [5], 'showRootNode' => false]]
        );

        self::assertSame(self::MODULE, $settings->module);
        self::assertSame([5], $settings->entryPoints);
        self::assertFalse($settings->showRootNode);
        // Untouched by the module, so the extension configuration still applies.
        self::assertSame(3, $settings->levelsToFetch);
    }

    #[Test]
    public function userTsConfigOverridesTheModuleRegistry(): void
    {
        $settings = $this->resolve(
            self::MODULE,
            ['entryPoints' => '1', 'levelsToFetch' => 3, 'rootNodeLabel' => 'From extension configuration'],
            [self::MODULE => ['levelsToFetch' => 4, 'rootNodeLabel' => 'From the registry']],
            2
        );

        self::assertSame(5, $settings->levelsToFetch);
        self::assertSame('From TSconfig', $settings->rootNodeLabel);
        self::assertSame([5], $settings->entryPoints);
    }

    #[Test]
    public function settingsOfAnotherModuleAreIgnored(): void
    {
        $settings = $this->resolve(
            self::MODULE,
            ['levelsToFetch' => 3],
            ['some_other_module' => ['levelsToFetch' => 9]]
        );

        self::assertSame(3, $settings->levelsToFetch);
    }

    #[Test]
    public function anUnknownModuleIsNotTrusted(): void
    {
        // The identifier reaches the endpoint as a query parameter, so a module that does
        // not exist (or that the user may not enter) never selects settings of its own.
        $settings = $this->resolve(
            'not_a_module',
            ['levelsToFetch' => 3],
            ['not_a_module' => ['levelsToFetch' => 9]]
        );

        self::assertNull($settings->module);
        self::assertSame(3, $settings->levelsToFetch);
    }

    #[Test]
    public function excludedCategoriesAreMergedLikeEveryOtherSetting(): void
    {
        $settings = $this->resolve(
            self::MODULE,
            ['excludeCategories' => '2,3'],
            [self::MODULE => ['excludeCategories' => [4]]]
        );

        self::assertSame([4], $settings->excludeCategories);
    }

    #[Test]
    public function excludedCategoriesFallBackToTheExtensionConfiguration(): void
    {
        self::assertSame([2, 3], $this->resolve(self::MODULE, ['excludeCategories' => '2,3'])->excludeCategories);
    }

    #[Test]
    public function levelsToFetchNeverDropsBelowOne(): void
    {
        self::assertSame(1, $this->resolve(self::MODULE, [], [self::MODULE => ['levelsToFetch' => 0]])->levelsToFetch);
    }
}
