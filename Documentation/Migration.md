# Migrating from the `xima_typo3_recordlist` prototype

The category tree started as a feature branch of `xima/xima-typo3-recordlist`
(branch `category-tree`) and was extracted into this extension. This is what changed and
how to move a consumer over.

## Renames

| Prototype (`Xima\XimaTypo3Recordlist\…`)                  | Here (`MaikSchneider\CategoryTree\…`)                    |
|-----------------------------------------------------------|-----------------------------------------------------------|
| `Controller\CategoryTreeController`                        | `Controller\CategoryTreeController`                        |
| `Domain\Repository\CategoryTreeRepository`                 | `Domain\Repository\CategoryTreeRepository`                 |
| `Dto\Tree\CategoryTreeItem`                                | `Dto\Tree\CategoryTreeItem`                                |
| `Event\AfterCategoryTreeItemsPreparedEvent`                | `Event\AfterCategoryTreeItemsPreparedEvent`                |

| Prototype                                        | Here                                                      |
|--------------------------------------------------|-----------------------------------------------------------|
| `@xima/recordlist/category-tree-element`         | `@maikschneider/category-tree/category-tree-element`      |
| `ajax_xima_categorytree_configuration`           | `ajax_category_tree_configuration`                        |
| `ajax_xima_categorytree_data`                    | `ajax_category_tree_data`                                 |
| `ajax_xima_categorytree_filter`                  | `ajax_category_tree_filter`                               |
| *(page tree's `ajax_page_tree_rootline`)*        | `ajax_category_tree_rootline`                             |
| `typo3-backend-navigation-component-categorytree`| `typo3-backend-navigation-component-category-tree`         |
| `EditablePageTree` / `PageTreeNavigationComponent` / `PageTreeToolbar` | `EditableCategoryTree` / `CategoryTreeNavigationComponent` / `CategoryTreeToolbar` |

## Behavioural differences

- **Node payload.** `doktype` is now `categoryType`. The page-tree leftovers
  `workspaceId`, `locked`, `stopPageTree` and `mountPoint` are gone from the DTO.
- **No temporary mount point.** The prototype reused the page tree's mount point endpoint
  and the `pageTree_temporaryMountPoint` persistent key, both of which operate on *pages*.
  Entry points replace that; see [EntryPoints.md](EntryPoints.md).
- **No page tree cross-talk.** The component listens on `typo3:categorytree:refresh` and
  `typo3:categorytree:selectFirstNode` instead of the `typo3:pagetree:*` events, and it
  stores its selection under the `category` module state instead of `web`. A page tree
  refresh no longer reloads the category tree, and vice versa.
- **Titles are no longer double-escaped.** The prototype ran `htmlspecialchars()` over the
  node title before handing it to Lit, which escapes again — a category named `A & B`
  rendered as `A &amp; B`.
- **Extends `Tree`, not `PageTree`.** The page-specific content-element drop handling and
  the `DataTransferTypes.pages` payload are gone; dragging a category no longer looks like
  dragging a page to other drop targets.

## Consumer checklist

1. `composer require maikschneider/category-tree`.
2. Point the module's `navigationComponent` at
   `@maikschneider/category-tree/category-tree-element`, and set
   `'inheritNavigationComponentFromMainModule' => false` alongside it. A module below
   `web`/`content` otherwise inherits the parent's page tree and the setting is ignored
   without any error.
3. Update the `use` statement of any `AfterCategoryTreeItemsPreparedEvent` listener to the
   new namespace. The event API is unchanged.
4. If a listener read `doktype` off an item, read `categoryType`.
5. Keep reading the selection from the `category` query parameter — that contract did not
   change.

## Leaving the prototype in place

`xima_typo3_recordlist`'s `category-tree` branch still ships its own copy. Nothing here
conflicts with it at the PHP level (different namespaces, different route identifiers,
different custom element names), so both can be installed side by side during a
transition. Do not enable both navigation components on the *same* module.

The list filtering itself (`AbstractBackendController::addCategoryConstraint()`, which
turns `category=<uid>` into an MM constraint on the record list query) stayed in
`xima_typo3_recordlist` — it is record-list logic, not navigation logic.
