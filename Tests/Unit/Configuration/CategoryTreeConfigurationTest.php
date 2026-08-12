<?php

declare(strict_types=1);

namespace MaikSchneider\CategoryTree\Tests\Unit\Configuration;

use MaikSchneider\CategoryTree\Configuration\CategoryTreeConfiguration;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Test;
use TYPO3\CMS\Core\Configuration\Exception\ExtensionConfigurationExtensionNotConfiguredException;
use TYPO3\CMS\Core\Configuration\ExtensionConfiguration;
use TYPO3\TestingFramework\Core\Unit\UnitTestCase;

final class CategoryTreeConfigurationTest extends UnitTestCase
{
    /**
     * @var array<string, mixed>|null
     */
    private ?array $extensionsBackup = null;

    protected function setUp(): void
    {
        parent::setUp();
        $this->extensionsBackup = $GLOBALS['TYPO3_CONF_VARS']['EXTENSIONS'] ?? null;
    }

    protected function tearDown(): void
    {
        $GLOBALS['TYPO3_CONF_VARS']['EXTENSIONS'] = $this->extensionsBackup;
        parent::tearDown();
    }

    /**
     * @param array<string, mixed> $configuration
     */
    private function createSubject(array $configuration): CategoryTreeConfiguration
    {
        $extensionConfiguration = $this->createMock(ExtensionConfiguration::class);
        $extensionConfiguration->method('get')->willReturn($configuration);

        return new CategoryTreeConfiguration($extensionConfiguration);
    }

    #[Test]
    public function everySettingFallsBackToItsDefaultWhenTheExtensionWasNeverConfigured(): void
    {
        $extensionConfiguration = $this->createMock(ExtensionConfiguration::class);
        $extensionConfiguration->method('get')
            ->willThrowException(new ExtensionConfigurationExtensionNotConfiguredException());
        $subject = new CategoryTreeConfiguration($extensionConfiguration);

        self::assertSame([], $subject->getEntryPoints());
        self::assertTrue($subject->isRootNodeEnabled());
        self::assertSame('', $subject->getRootNodeLabel());
        self::assertSame(2, $subject->getLevelsToFetch());
        self::assertTrue($subject->shouldShowHiddenCategories());
        self::assertTrue($subject->isCategoryModuleEnabled());
    }

    /**
     * @return array<string, array{0: string, 1: int[]}>
     */
    public static function entryPointDataProvider(): array
    {
        return [
            'empty' => ['', []],
            'single uid' => ['12', [12]],
            'multiple uids' => ['12,48', [12, 48]],
            'whitespace and empty segments' => [' 12 , , 48 ', [12, 48]],
            'non numeric segments are dropped' => ['12,abc,48', [12, 48]],
        ];
    }

    /**
     * @param int[] $expected
     */
    #[Test]
    #[DataProvider('entryPointDataProvider')]
    public function entryPointsAreParsedIntoIntegers(string $configured, array $expected): void
    {
        self::assertSame($expected, $this->createSubject(['entryPoints' => $configured])->getEntryPoints());
    }

    #[Test]
    public function levelsToFetchIsNeverBelowOne(): void
    {
        self::assertSame(1, $this->createSubject(['levelsToFetch' => '0'])->getLevelsToFetch());
        self::assertSame(1, $this->createSubject(['levelsToFetch' => '-5'])->getLevelsToFetch());
        self::assertSame(4, $this->createSubject(['levelsToFetch' => '4'])->getLevelsToFetch());
    }

    #[Test]
    public function booleanSettingsCanBeSwitchedOff(): void
    {
        $subject = $this->createSubject([
            'showRootNode' => '0',
            'showHiddenCategories' => '0',
            'enableCategoryModule' => '0',
        ]);

        self::assertFalse($subject->isRootNodeEnabled());
        self::assertFalse($subject->shouldShowHiddenCategories());
        self::assertFalse($subject->isCategoryModuleEnabled());
    }

    #[Test]
    public function rootNodeLabelIsTrimmed(): void
    {
        self::assertSame('Taxonomy', $this->createSubject(['rootNodeLabel' => '  Taxonomy  '])->getRootNodeLabel());
    }

    #[Test]
    public function readRawFallsBackToTheDefaultWhenTypo3ConfVarsHasNoValue(): void
    {
        unset($GLOBALS['TYPO3_CONF_VARS']['EXTENSIONS']['category_tree']);

        self::assertTrue(CategoryTreeConfiguration::readRaw('enableCategoryModule'));
    }

    #[Test]
    public function readRawReturnsTheConfiguredValue(): void
    {
        $GLOBALS['TYPO3_CONF_VARS']['EXTENSIONS']['category_tree']['enableCategoryModule'] = '0';

        self::assertSame('0', CategoryTreeConfiguration::readRaw('enableCategoryModule'));
    }
}
