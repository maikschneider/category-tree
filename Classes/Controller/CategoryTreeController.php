<?php

declare(strict_types=1);

namespace MaikSchneider\CategoryTree\Controller;

use MaikSchneider\CategoryTree\Configuration\CategoryTreeConfiguration;
use MaikSchneider\CategoryTree\Domain\Repository\CategoryTreeRepository;
use MaikSchneider\CategoryTree\Dto\Tree\CategoryTreeItem;
use MaikSchneider\CategoryTree\Event\AfterCategoryTreeItemsPreparedEvent;
use MaikSchneider\CategoryTree\Service\EntryPointResolver;
use Psr\EventDispatcher\EventDispatcherInterface;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use TYPO3\CMS\Backend\Attribute\AsController;
use TYPO3\CMS\Backend\Dto\Tree\TreeItem;
use TYPO3\CMS\Backend\Routing\UriBuilder;
use TYPO3\CMS\Core\Authentication\BackendUserAuthentication;
use TYPO3\CMS\Core\Authentication\JsConfirmation;
use TYPO3\CMS\Core\Http\JsonResponse;
use TYPO3\CMS\Core\Imaging\IconFactory;
use TYPO3\CMS\Core\Imaging\IconSize;
use TYPO3\CMS\Core\Localization\LanguageService;
use TYPO3\CMS\Core\Schema\Struct\SelectItem;
use TYPO3\CMS\Core\Utility\MathUtility;

/**
 * Serves the three AJAX endpoints the category tree navigation component talks to:
 * its settings, the (lazily loaded) node data, and the search filter.
 */
#[AsController]
class CategoryTreeController
{
    protected const DEFAULT_ICON = 'mimetypes-x-sys_category';
    protected const ROOT_IDENTIFIER = '0';

    public function __construct(
        protected readonly IconFactory $iconFactory,
        protected readonly UriBuilder $uriBuilder,
        protected readonly EventDispatcherInterface $eventDispatcher,
        protected readonly CategoryTreeRepository $categoryTreeRepository,
        protected readonly CategoryTreeConfiguration $configuration,
        protected readonly EntryPointResolver $entryPointResolver,
    ) {
    }

    /**
     * Settings consumed by the "setup" property of the tree custom element.
     */
    public function fetchConfigurationAction(): ResponseInterface
    {
        $typeField = $this->getTypeField();

        return new JsonResponse([
            'allowDragMove' => $this->userCanModifyCategories(),
            'canModify' => $this->userCanModifyCategories(),
            'categoryTypes' => $this->getCategoryTypes($typeField),
            'typeField' => $typeField,
            'displayDeleteConfirmation' => $this->getBackendUser()->jsConfirmation(JsConfirmation::DELETE),
            'showIcons' => true,
            'dataUrl' => (string)$this->uriBuilder->buildUriFromRoute('ajax_category_tree_data'),
            'filterUrl' => (string)$this->uriBuilder->buildUriFromRoute('ajax_category_tree_filter'),
            'rootlineUrl' => (string)$this->uriBuilder->buildUriFromRoute('ajax_category_tree_rootline'),
        ]);
    }

    /**
     * Returns the flattened tree. Without a "parent" query parameter the configured entry
     * points are returned, otherwise the children of the requested node.
     */
    public function fetchDataAction(ServerRequestInterface $request): ResponseInterface
    {
        $includeHidden = $this->configuration->shouldShowHiddenCategories();
        $levelsToFetch = $this->configuration->getLevelsToFetch();
        $parentIdentifier = $request->getQueryParams()['parent'] ?? null;

        if ($parentIdentifier !== null && MathUtility::canBeInterpretedAsInteger($parentIdentifier)) {
            $startDepth = (int)($request->getQueryParams()['depth'] ?? 0) + 1;
            $categories = $this->categoryTreeRepository->findChildren((int)$parentIdentifier, $includeHidden);
            $items = $this->flattenAll($categories, $startDepth, $startDepth + $levelsToFetch - 1);

            return new JsonResponse($this->prepareItems($request, $items));
        }

        $categories = $this->categoryTreeRepository->findTree($this->entryPointResolver->resolve(), $includeHidden);
        $showRootNode = $this->configuration->isRootNodeEnabled();
        $startDepth = $showRootNode ? 1 : 0;

        $items = [];
        if ($showRootNode) {
            $items[] = $this->createRootItem($categories !== []);
        }
        // An entry point may sit anywhere in the category hierarchy, so its real parent is
        // not part of the payload — it is re-parented to the synthetic root or to nothing.
        $items = array_merge($items, $this->flattenAll(
            $categories,
            $startDepth,
            $startDepth + $levelsToFetch - 1,
            $showRootNode ? self::ROOT_IDENTIFIER : ''
        ));

        return new JsonResponse($this->prepareItems($request, $items));
    }

    /**
     * Returns the branches whose title matches the search term.
     */
    public function filterDataAction(ServerRequestInterface $request): ResponseInterface
    {
        $searchTerm = (string)($request->getQueryParams()['q'] ?? '');
        if (trim($searchTerm) === '') {
            return new JsonResponse([]);
        }

        $includeHidden = $this->configuration->shouldShowHiddenCategories();
        $categories = $this->categoryTreeRepository->findTree($this->entryPointResolver->resolve(), $includeHidden);
        $matched = $this->categoryTreeRepository->filterTree($categories, $searchTerm);

        // A filtered result is always fully expanded, so no depth limit applies.
        $items = $this->flattenAll($matched, 0, PHP_INT_MAX, '');

        return new JsonResponse($this->prepareItems($request, $items));
    }

    /**
     * Ancestor chain of a category, used by the tree to reveal a node that was selected elsewhere.
     */
    public function fetchRootlineAction(ServerRequestInterface $request): ResponseInterface
    {
        $identifier = $request->getQueryParams()['identifier'] ?? null;
        if ($identifier === null || !MathUtility::canBeInterpretedAsInteger($identifier)) {
            return new JsonResponse(['rootline' => []]);
        }

        $rootline = $this->categoryTreeRepository->findRootline(
            (int)$identifier,
            $this->configuration->shouldShowHiddenCategories()
        );

        if ($this->configuration->isRootNodeEnabled()) {
            array_unshift($rootline, 0);
        }

        return new JsonResponse(['rootline' => array_map(strval(...), $rootline)]);
    }

    /**
     * @return array<string, mixed>
     */
    protected function createRootItem(bool $hasChildren): array
    {
        return [
            'identifier' => self::ROOT_IDENTIFIER,
            'parentIdentifier' => '',
            'recordType' => CategoryTreeRepository::TABLE,
            'name' => $this->getRootNodeLabel(),
            'depth' => 0,
            'icon' => 'apps-pagetree-root',
            'hasChildren' => $hasChildren,
            'loaded' => true,
            'editable' => false,
            'deletable' => false,
            'categoryType' => 0,
            'nameSourceField' => 'title',
            'storagePid' => 0,
            'sorting' => 0,
        ];
    }

    protected function getRootNodeLabel(): string
    {
        $configured = $this->configuration->getRootNodeLabel();
        if ($configured !== '') {
            return $this->getLanguageService()?->sL($configured) ?: $configured;
        }

        return $this->getLanguageService()?->sL(
            'LLL:EXT:category_tree/Resources/Private/Language/locallang.xlf:tree.allCategories'
        ) ?: 'All categories';
    }

    /**
     * @param array<int, array<string, mixed>> $categories
     * @param string|null $parentIdentifier Re-parents this level; null keeps the real parent uid
     * @return array<int, array<string, mixed>>
     */
    protected function flattenAll(array $categories, int $depth, int $maxDepth, ?string $parentIdentifier = null): array
    {
        $items = [];
        foreach ($categories as $category) {
            $items = array_merge($items, $this->flatten($category, $depth, $maxDepth, $parentIdentifier));
        }

        return $items;
    }

    /**
     * @param array<string, mixed> $category
     * @return array<int, array<string, mixed>>
     */
    protected function flatten(array $category, int $depth, int $maxDepth, ?string $parentIdentifier = null): array
    {
        $hasChildren = ($category['children'] ?? []) !== [];
        $childrenIncluded = $hasChildren && $depth < $maxDepth;
        $icon = $this->iconFactory->getIconForRecord(CategoryTreeRepository::TABLE, $category, IconSize::SMALL);
        $typeField = $this->getTypeField();

        $items = [[
            'identifier' => (string)(int)$category['uid'],
            'parentIdentifier' => $parentIdentifier ?? (string)(int)($category['parent'] ?? 0),
            'recordType' => CategoryTreeRepository::TABLE,
            'name' => (string)($category['title'] ?? ''),
            'depth' => $depth,
            'icon' => $icon->getIdentifier(),
            'overlayIcon' => $icon->getOverlayIcon()?->getIdentifier() ?? '',
            'editable' => $this->userCanModifyCategories(),
            'deletable' => $this->userCanModifyCategories(),
            'hasChildren' => $hasChildren,
            'loaded' => $childrenIncluded || !$hasChildren,
            'categoryType' => $typeField !== '' ? (int)($category[$typeField] ?? 0) : 0,
            'nameSourceField' => 'title',
            'storagePid' => (int)($category['pid'] ?? 0),
            'sorting' => (int)($category['sorting'] ?? 0),
        ]];

        if ($childrenIncluded) {
            $items = array_merge($items, $this->flattenAll($category['children'], $depth + 1, $maxDepth));
        }

        return $items;
    }

    /**
     * Dispatches the modification event and maps the raw arrays onto the tree item DTO.
     *
     * @param array<int, array<string, mixed>> $items
     * @return array<int, CategoryTreeItem>
     */
    protected function prepareItems(ServerRequestInterface $request, array $items): array
    {
        /** @var AfterCategoryTreeItemsPreparedEvent $event */
        $event = $this->eventDispatcher->dispatch(new AfterCategoryTreeItemsPreparedEvent($request, $items));
        $items = $event->getItems();

        return array_map(
            static fn (array $item): CategoryTreeItem => new CategoryTreeItem(
                new TreeItem(
                    identifier: (string)$item['identifier'],
                    parentIdentifier: (string)($item['parentIdentifier'] ?? ''),
                    recordType: (string)($item['recordType'] ?? ''),
                    name: (string)($item['name'] ?? ''),
                    note: (string)($item['note'] ?? ''),
                    prefix: (string)($item['prefix'] ?? ''),
                    suffix: (string)($item['suffix'] ?? ''),
                    tooltip: (string)($item['tooltip'] ?? ''),
                    depth: (int)($item['depth'] ?? 0),
                    hasChildren: (bool)($item['hasChildren'] ?? false),
                    loaded: (bool)($item['loaded'] ?? false),
                    editable: (bool)($item['editable'] ?? false),
                    deletable: (bool)($item['deletable'] ?? false),
                    icon: (string)($item['icon'] ?? ''),
                    overlayIcon: (string)($item['overlayIcon'] ?? ''),
                    statusInformation: (array)($item['statusInformation'] ?? []),
                    labels: (array)($item['labels'] ?? []),
                ),
                categoryType: (int)($item['categoryType'] ?? 0),
                nameSourceField: (string)($item['nameSourceField'] ?? 'title'),
                storagePid: (int)($item['storagePid'] ?? 0),
                sorting: (int)($item['sorting'] ?? 0),
            ),
            $items
        );
    }

    /**
     * The TCA type field of sys_category, if the installation defines category types at all.
     */
    protected function getTypeField(): string
    {
        return (string)($GLOBALS['TCA'][CategoryTreeRepository::TABLE]['ctrl']['type'] ?? '');
    }

    /**
     * Draggable "create new category" entries for the toolbar — one per TCA type,
     * or a single generic one when sys_category has no type field.
     *
     * @return array<int, array{nodeType: int|string, icon: string, title: string}>
     */
    protected function getCategoryTypes(string $typeField): array
    {
        $tca = $GLOBALS['TCA'][CategoryTreeRepository::TABLE] ?? [];

        if ($typeField === '') {
            return [[
                'nodeType' => 0,
                'icon' => (string)($tca['ctrl']['iconfile'] ?? self::DEFAULT_ICON),
                'title' => (string)($this->getLanguageService()?->sL($tca['ctrl']['title'] ?? '') ?: 'Category'),
            ]];
        }

        $types = [];
        foreach ($tca['columns'][$typeField]['config']['items'] ?? [] as $itemConfig) {
            $selectItem = SelectItem::fromTcaItemArray($itemConfig);
            if ($selectItem->isDivider()) {
                continue;
            }
            $value = $selectItem->getValue();
            $types[] = [
                'nodeType' => $value,
                'icon' => (string)($tca['ctrl']['typeicon_classes'][$value] ?? self::DEFAULT_ICON),
                'title' => (string)($this->getLanguageService()?->sL($selectItem->getLabel()) ?: (string)$value),
            ];
        }

        return $types;
    }

    /**
     * Whether the current backend user may write sys_category records at all.
     * Record level access is still enforced by DataHandler on the actual write.
     */
    protected function userCanModifyCategories(): bool
    {
        return $this->getBackendUser()->check('tables_modify', CategoryTreeRepository::TABLE);
    }

    protected function getBackendUser(): BackendUserAuthentication
    {
        return $GLOBALS['BE_USER'];
    }

    protected function getLanguageService(): ?LanguageService
    {
        return $GLOBALS['LANG'] ?? null;
    }
}
