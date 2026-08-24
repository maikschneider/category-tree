<?php

declare(strict_types=1);

use MaikSchneider\CategoryTree\Middleware\PageIdParameterRemover;

return [
    'backend' => [
        'maikschneider/category-tree/page-id-parameter-remover' => [
            'target' => PageIdParameterRemover::class,
            // The route carries the module from "backend-routing" on, and
            // "backend-module-validator" is what rejects the parameter.
            'after' => [
                'typo3/cms-backend/backend-routing',
            ],
            'before' => [
                'typo3/cms-backend/backend-module-validator',
            ],
        ],
    ],
];
