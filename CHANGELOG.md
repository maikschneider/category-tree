# Changelog

All notable changes to this project are documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Category tree navigation component for backend modules
  (`@maikschneider/category-tree/category-tree-element`), with drag-create, in-place
  rename, move/copy, delete and search.
- Configurable entry points: the tree can start at any set of `sys_category` UIDs
  instead of the top level, resolved through the decoratable `EntryPointResolver`.
- Optional **Web > Categories** backend module that hands the selected category to the
  regular TYPO3 record form. Can be switched off in the extension configuration.
- `AfterCategoryTreeItemsPreparedEvent` for decorating tree nodes.
- `ajax_category_tree_rootline` endpoint for revealing a node selected elsewhere.
