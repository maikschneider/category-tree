<?php

declare(strict_types=1);

return [
    'dependencies' => [
        'core',
        'backend',
    ],
    'tags' => [
        'backend.navigation-component',
    ],
    'imports' => [
        '@maikschneider/category-tree/' => 'EXT:category_tree/Resources/Public/JavaScript/',
    ],
];
