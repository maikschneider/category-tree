<?php

declare(strict_types=1);

use MaikSchneider\CategoryTreeSecond\Controller\SecondModuleController;

return [
    'category_tree_second' => [
        'parent' => 'web',
        'position' => ['after' => 'category_tree'],
        'access' => 'user',
        'path' => '/module/web/categories-second',
        'iconIdentifier' => 'category-tree-module',
        'labels' => [
            'title' => 'Second categories',
        ],
        'inheritNavigationComponentFromMainModule' => false,
        'navigationComponent' => '@maikschneider/category-tree/category-tree-element',
        'routes' => [
            '_default' => [
                'target' => SecondModuleController::class . '::handleRequest',
            ],
        ],
    ],
];
