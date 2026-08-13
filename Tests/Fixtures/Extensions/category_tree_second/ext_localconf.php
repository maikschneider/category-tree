<?php

defined('TYPO3') or die();

// The module registry layer of the per-module settings: this module starts at "Vegetables"
// and hides the root node, while the installation-wide configuration says otherwise.
$GLOBALS['TYPO3_CONF_VARS']['EXTENSIONS']['category_tree']['modules']['category_tree_second'] = [
    'entryPoints' => [5],
    'showRootNode' => false,
];
