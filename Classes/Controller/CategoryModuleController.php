<?php

declare(strict_types=1);

namespace MaikSchneider\CategoryTree\Controller;

use MaikSchneider\CategoryTree\Configuration\CategoryTreeConfiguration;
use MaikSchneider\CategoryTree\Domain\Repository\CategoryTreeRepository;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use TYPO3\CMS\Backend\Attribute\AsController;
use TYPO3\CMS\Backend\Routing\UriBuilder;
use TYPO3\CMS\Backend\Template\ModuleTemplateFactory;
use TYPO3\CMS\Core\Http\RedirectResponse;
use TYPO3\CMS\Core\Utility\MathUtility;

/**
 * The optional "Categories" backend module.
 *
 * It owns no editing UI of its own: selecting a node in the category tree hands the
 * record over to the regular TYPO3 edit form (record_edit). Without a selection the
 * module renders a short hint instead.
 */
#[AsController]
class CategoryModuleController
{
    public const MODULE_IDENTIFIER = 'category_tree';

    public function __construct(
        private readonly ModuleTemplateFactory $moduleTemplateFactory,
        private readonly UriBuilder $uriBuilder,
        private readonly CategoryTreeRepository $categoryTreeRepository,
        private readonly CategoryTreeConfiguration $configuration,
    ) {
    }

    public function handleRequest(ServerRequestInterface $request): ResponseInterface
    {
        $categoryUid = $this->getSelectedCategoryUid($request);

        if ($categoryUid > 0 && $this->categoryExists($categoryUid)) {
            return new RedirectResponse($this->buildEditUri($categoryUid));
        }

        $view = $this->moduleTemplateFactory->create($request);
        $view->setTitle($this->getModuleTitle($request));
        $view->assign('unknownCategorySelected', $categoryUid > 0);

        return $view->renderResponse('CategoryModule/Index');
    }

    private function getSelectedCategoryUid(ServerRequestInterface $request): int
    {
        $category = $request->getQueryParams()['category'] ?? null;

        return $category !== null && MathUtility::canBeInterpretedAsInteger($category) ? (int)$category : 0;
    }

    private function categoryExists(int $categoryUid): bool
    {
        $includeHidden = $this->configuration->shouldShowHiddenCategories();

        return $this->categoryTreeRepository->findByUid($categoryUid, $includeHidden) !== null;
    }

    /**
     * Opens the record in FormEngine and returns to the empty module view on "close",
     * so closing the form does not bounce straight back into it.
     */
    private function buildEditUri(int $categoryUid): string
    {
        return (string)$this->uriBuilder->buildUriFromRoute('record_edit', [
            'edit' => [
                CategoryTreeRepository::TABLE => [
                    $categoryUid => 'edit',
                ],
            ],
            'returnUrl' => (string)$this->uriBuilder->buildUriFromRoute(self::MODULE_IDENTIFIER),
        ]);
    }

    /**
     * The module registry stores the raw "LLL:" reference, so it still needs translating.
     */
    private function getModuleTitle(ServerRequestInterface $request): string
    {
        $title = (string)($request->getAttribute('module')?->getTitle() ?? '');

        return ($GLOBALS['LANG'] ?? null)?->sL($title) ?: $title;
    }
}
