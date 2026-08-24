<?php

declare(strict_types=1);

use MaikSchneider\CategoryTree\Configuration\CategoryTreeConfiguration;
use MaikSchneider\CategoryTree\Controller\CategoryModuleController;

/**
 * The category management module is optional and can be switched off in the extension
 * configuration. This file is evaluated while the module registry is built, before a DI
 * container exists, so the setting is read straight from TYPO3_CONF_VARS.
 */
if (!CategoryTreeConfiguration::readRaw('enableCategoryModule')) {
    return [];
}

return [
    CategoryModuleController::MODULE_IDENTIFIER => [
        'parent' => 'web',
        'position' => ['after' => 'web_list'],
        'access' => 'user',
        'path' => '/module/web/categories',
        'iconIdentifier' => 'category-tree-module',
        'labels' => 'LLL:EXT:category_tree/Resources/Private/Language/locallang_mod.xlf',
        // The parent module ("content", aliased "web") ships the page tree, and a submodule
        // inherits it unless inheritance is switched off explicitly.
        'inheritNavigationComponentFromMainModule' => false,
        'navigationComponent' => CategoryTreeConfiguration::NAVIGATION_COMPONENT,
        'routes' => [
            '_default' => [
                'target' => CategoryModuleController::class . '::handleRequest',
            ],
        ],
    ],
];
