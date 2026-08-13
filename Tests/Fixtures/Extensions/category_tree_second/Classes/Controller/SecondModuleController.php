<?php

declare(strict_types=1);

namespace MaikSchneider\CategoryTreeSecond\Controller;

use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use TYPO3\CMS\Backend\Attribute\AsController;
use TYPO3\CMS\Core\Http\HtmlResponse;

/**
 * Renders nothing but the selected category, which is all an acceptance test needs from a
 * module that reuses the category tree.
 */
#[AsController]
final class SecondModuleController
{
    public function handleRequest(ServerRequestInterface $request): ResponseInterface
    {
        $category = (int)($request->getQueryParams()['category'] ?? 0);

        return new HtmlResponse(
            '<!DOCTYPE html><html lang="en"><body>'
            . '<h1 id="second-module">Second categories</h1>'
            . '<p id="selected-category">' . $category . '</p>'
            . '</body></html>'
        );
    }
}
