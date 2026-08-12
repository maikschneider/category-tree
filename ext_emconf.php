<?php

$EM_CONF[$_EXTKEY] = [
    'title' => 'Category Tree',
    'description' => 'Reusable category tree navigation component for TYPO3 backend modules, plus an optional category management module.',
    'category' => 'be',
    'author' => 'Maik Schneider',
    'author_email' => 'schneider.maik@me.com',
    'state' => 'beta',
    'version' => '0.1.0',
    'constraints' => [
        'depends' => [
            'typo3' => '13.4.0-14.99.99',
            'backend' => '13.4.0-14.99.99',
        ],
        'conflicts' => [],
        'suggests' => [],
    ],
];
