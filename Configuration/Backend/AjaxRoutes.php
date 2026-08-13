<?php

declare(strict_types=1);

use MaikSchneider\CategoryTree\Controller\CategoryTreeController;

/**
 * Endpoints of the category tree navigation component.
 */
return [
    'category_tree_configuration' => [
        'path' => '/category-tree/configuration',
        'target' => CategoryTreeController::class . '::fetchConfigurationAction',
    ],
    'category_tree_data' => [
        'path' => '/category-tree/data',
        'target' => CategoryTreeController::class . '::fetchDataAction',
    ],
    'category_tree_filter' => [
        'path' => '/category-tree/filter',
        'target' => CategoryTreeController::class . '::filterDataAction',
    ],
    'category_tree_descendants' => [
        'path' => '/category-tree/descendants',
        'target' => CategoryTreeController::class . '::fetchDescendantsAction',
    ],
    'category_tree_rootline' => [
        'path' => '/category-tree/rootline',
        'target' => CategoryTreeController::class . '::fetchRootlineAction',
    ],
];
