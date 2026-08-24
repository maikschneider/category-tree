<?php

declare(strict_types=1);

namespace MaikSchneider\CategoryTree\Middleware;

use MaikSchneider\CategoryTree\Configuration\CategoryTreeConfiguration;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\MiddlewareInterface;
use Psr\Http\Server\RequestHandlerInterface;
use TYPO3\CMS\Backend\Module\ModuleInterface;
use TYPO3\CMS\Backend\Routing\Route;
use TYPO3\CMS\Core\Http\RedirectResponse;

/**
 * Drops the "id" query parameter from modules that use the category tree.
 *
 * The backend treats "id" as a page uid: the module menu prepends it to every module with a
 * navigation component (ModuleMenu.includeId), and BackendModuleValidator then rejects the
 * request with "You don't have access to this page" when it is not a page the user may see.
 * A module navigated by categories has no page uid to put there, so any "id" it is handed is
 * wrong by construction — whether it comes from a stale module state, a bookmark or a link.
 *
 * This runs before BackendModuleValidator, which is where the request would otherwise die,
 * and is therefore a middleware rather than something a controller could do.
 */
final class PageIdParameterRemover implements MiddlewareInterface
{
    private const PARAMETER = 'id';

    public function process(ServerRequestInterface $request, RequestHandlerInterface $handler): ResponseInterface
    {
        $queryParams = $request->getQueryParams();
        if (!isset($queryParams[self::PARAMETER]) || !$this->usesCategoryTree($request)) {
            return $handler->handle($request);
        }

        unset($queryParams[self::PARAMETER]);

        // A redirect also cleans up the address bar, so the parameter stops travelling with
        // every following request. A request carrying a body cannot survive one, so there
        // the parameter is only taken off the request.
        if (!in_array($request->getMethod(), ['GET', 'HEAD'], true)) {
            return $handler->handle($request->withQueryParams($queryParams));
        }

        return new RedirectResponse(
            (string)$request->getUri()->withQuery(http_build_query($queryParams)),
            302
        );
    }

    private function usesCategoryTree(ServerRequestInterface $request): bool
    {
        $route = $request->getAttribute('route');
        $module = $route instanceof Route ? $route->getOption('module') : null;

        return $module instanceof ModuleInterface
            && $module->getNavigationComponent() === CategoryTreeConfiguration::NAVIGATION_COMPONENT;
    }
}
