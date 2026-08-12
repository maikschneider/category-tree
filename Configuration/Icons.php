<?php

declare(strict_types=1);

use TYPO3\CMS\Core\Imaging\IconProvider\SvgIconProvider;
use TYPO3\CMS\Core\Information\Typo3Version;

/**
 * The backend icon style changed with TYPO3 v14: module icons are now monochrome
 * outlines tinted by the theme, while v13 still renders them as coloured tiles.
 * Both variants ship, and the matching one is picked for the running core.
 */
$moduleIcon = (new Typo3Version())->getMajorVersion() >= 14
    ? 'module-categories.svg'
    : 'module-categories-v13.svg';

return [
    'category-tree-module' => [
        'provider' => SvgIconProvider::class,
        'source' => 'EXT:category_tree/Resources/Public/Icons/' . $moduleIcon,
    ],
];
