<?php

declare(strict_types=1);

namespace MaikSchneider\CategoryTree\Configuration;

use TYPO3\CMS\Core\Configuration\Exception\ExtensionConfigurationExtensionNotConfiguredException;
use TYPO3\CMS\Core\Configuration\Exception\ExtensionConfigurationPathDoesNotExistException;
use TYPO3\CMS\Core\Configuration\ExtensionConfiguration;
use TYPO3\CMS\Core\SingletonInterface;
use TYPO3\CMS\Core\Utility\GeneralUtility;

/**
 * Typed access to the extension configuration of EXT:category_tree.
 *
 * Every setting has a defined fallback, so the tree stays functional on installations
 * where the extension configuration was never saved.
 */
class CategoryTreeConfiguration implements SingletonInterface
{
    public const EXTENSION_KEY = 'category_tree';

    private const DEFAULTS = [
        'entryPoints' => '',
        'showRootNode' => true,
        'rootNodeLabel' => '',
        'levelsToFetch' => 2,
        'showHiddenCategories' => true,
        'enableCategoryModule' => true,
    ];

    /**
     * @var array<string, mixed>|null
     */
    private ?array $configuration = null;

    public function __construct(private readonly ExtensionConfiguration $extensionConfiguration)
    {
    }

    /**
     * Configured entry point category UIDs. An empty array means "all top-level categories".
     *
     * @return int[]
     */
    public function getEntryPoints(): array
    {
        // intExplode casts non-numeric segments to 0, which is not a valid category uid.
        return array_values(array_filter(
            GeneralUtility::intExplode(',', (string)$this->get('entryPoints'), true),
            static fn (int $uid): bool => $uid > 0
        ));
    }

    public function isRootNodeEnabled(): bool
    {
        return (bool)$this->get('showRootNode');
    }

    /**
     * Raw root node label. May be an LLL: reference or empty (caller falls back to the default label).
     */
    public function getRootNodeLabel(): string
    {
        return trim((string)$this->get('rootNodeLabel'));
    }

    public function getLevelsToFetch(): int
    {
        return max(1, (int)$this->get('levelsToFetch'));
    }

    public function shouldShowHiddenCategories(): bool
    {
        return (bool)$this->get('showHiddenCategories');
    }

    public function isCategoryModuleEnabled(): bool
    {
        return (bool)$this->get('enableCategoryModule');
    }

    private function get(string $key): mixed
    {
        if ($this->configuration === null) {
            try {
                $configuration = $this->extensionConfiguration->get(self::EXTENSION_KEY);
            } catch (ExtensionConfigurationExtensionNotConfiguredException|ExtensionConfigurationPathDoesNotExistException) {
                $configuration = [];
            }
            $this->configuration = is_array($configuration) ? $configuration : [];
        }

        $value = $this->configuration[$key] ?? null;

        return $value === null || $value === '' ? self::DEFAULTS[$key] : $value;
    }

    /**
     * Reads a single setting without the DI container.
     *
     * Needed by Configuration/Backend/Modules.php, which is evaluated while the module
     * registry is built — long before a container is available.
     */
    public static function readRaw(string $key): mixed
    {
        $value = $GLOBALS['TYPO3_CONF_VARS']['EXTENSIONS'][self::EXTENSION_KEY][$key] ?? null;

        return $value === null || $value === '' ? self::DEFAULTS[$key] : $value;
    }
}
