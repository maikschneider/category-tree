<?php

declare(strict_types=1);

namespace MaikSchneider\CategoryTree\Configuration;

use Psr\Http\Message\ServerRequestInterface;
use TYPO3\CMS\Backend\Module\ModuleProvider;
use TYPO3\CMS\Core\Authentication\BackendUserAuthentication;
use TYPO3\CMS\Core\SingletonInterface;
use TYPO3\CMS\Core\Utility\GeneralUtility;

/**
 * Merges the settings of one request from three layers, each overriding the one before it:
 *
 * 1. the extension configuration — the installation-wide default
 * 2. the module registry — the defaults a module ships in its own ext_localconf.php
 * 3. User TSconfig — what an integrator sets per user or group
 *
 * See Documentation/ModuleSettings.md.
 */
class ModuleSettingsResolver implements SingletonInterface
{
    /**
     * TSconfig and the registry use the keys of the extension configuration.
     */
    private const KEYS = [
        'entryPoints',
        'showRootNode',
        'rootNodeLabel',
        'levelsToFetch',
        'showHiddenCategories',
    ];

    public function __construct(
        private readonly CategoryTreeConfiguration $configuration,
        private readonly ModuleProvider $moduleProvider,
    ) {
    }

    public function resolve(ServerRequestInterface $request): CategoryTreeSettings
    {
        return $this->resolveForModule($this->resolveModuleIdentifier($request));
    }

    public function resolveForModule(?string $moduleIdentifier): CategoryTreeSettings
    {
        $values = $this->overlay(
            $this->configuration->getAll(),
            $this->registrySettings($moduleIdentifier),
            $this->tsConfigSettings($moduleIdentifier)
        );

        return new CategoryTreeSettings(
            entryPoints: $this->toEntryPoints($values['entryPoints']),
            showRootNode: (bool)$values['showRootNode'],
            rootNodeLabel: trim((string)$values['rootNodeLabel']),
            levelsToFetch: max(1, (int)$values['levelsToFetch']),
            showHiddenCategories: (bool)$values['showHiddenCategories'],
            module: $moduleIdentifier,
        );
    }

    /**
     * The module the request was made from. It travels as a query parameter because the
     * tree endpoints are routes of their own and know nothing about the calling module,
     * so it is only accepted for a module that exists and that the user may enter.
     */
    private function resolveModuleIdentifier(ServerRequestInterface $request): ?string
    {
        $identifier = trim((string)($request->getQueryParams()['module'] ?? ''));
        if ($identifier === '') {
            return null;
        }

        return $this->moduleProvider->accessGranted($identifier, $this->getBackendUser())
            ? $identifier
            : null;
    }

    /**
     * @return array<string, mixed>
     */
    private function registrySettings(?string $moduleIdentifier): array
    {
        if ($moduleIdentifier === null) {
            return [];
        }

        $modules = $GLOBALS['TYPO3_CONF_VARS']['EXTENSIONS'][CategoryTreeConfiguration::EXTENSION_KEY]['modules'] ?? [];

        return is_array($modules[$moduleIdentifier] ?? null) ? $modules[$moduleIdentifier] : [];
    }

    /**
     * User TSconfig of the shape "mod.<module>.categoryTree.<setting>".
     *
     * @return array<string, mixed>
     */
    private function tsConfigSettings(?string $moduleIdentifier): array
    {
        if ($moduleIdentifier === null) {
            return [];
        }

        $moduleTsConfig = $this->getBackendUser()?->getTSConfig()['mod.'][$moduleIdentifier . '.']['categoryTree.'] ?? null;
        if (!is_array($moduleTsConfig)) {
            return [];
        }

        $settings = [];
        foreach (self::KEYS as $key) {
            if (isset($moduleTsConfig[$key])) {
                $settings[$key] = $moduleTsConfig[$key];
            }
        }

        return $settings;
    }

    /**
     * @param array<string, mixed> ...$layers
     * @return array<string, mixed>
     */
    private function overlay(array ...$layers): array
    {
        $values = [];
        foreach (self::KEYS as $key) {
            foreach ($layers as $layer) {
                // An unset key falls through to the layer below; an explicit empty string
                // does not, so a module may blank out a globally configured label.
                if (array_key_exists($key, $layer) && $layer[$key] !== null) {
                    $values[$key] = $layer[$key];
                }
            }
        }

        return $values;
    }

    /**
     * Entry points are a comma-separated list in the extension configuration and in
     * TSconfig, and may be a plain array of UIDs in the registry.
     *
     * @return int[]
     */
    private function toEntryPoints(mixed $value): array
    {
        $uids = is_array($value)
            ? array_map(intval(...), $value)
            // intExplode casts non-numeric segments to 0, which is not a valid category uid.
            : GeneralUtility::intExplode(',', (string)$value, true);

        return array_values(array_filter($uids, static fn (int $uid): bool => $uid > 0));
    }

    private function getBackendUser(): ?BackendUserAuthentication
    {
        return $GLOBALS['BE_USER'] ?? null;
    }
}
