<?php

declare(strict_types=1);

namespace MaikSchneider\CategoryTree\Tests\Unit\Middleware;

use MaikSchneider\CategoryTree\Configuration\CategoryTreeConfiguration;
use MaikSchneider\CategoryTree\Middleware\PageIdParameterRemover;
use PHPUnit\Framework\Attributes\Test;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;
use TYPO3\CMS\Backend\Module\ModuleInterface;
use TYPO3\CMS\Backend\Routing\Route;
use TYPO3\CMS\Core\Http\Response;
use TYPO3\CMS\Core\Http\ServerRequest;
use TYPO3\TestingFramework\Core\Unit\UnitTestCase;

final class PageIdParameterRemoverTest extends UnitTestCase
{
    private RecordingRequestHandler $handler;

    protected function setUp(): void
    {
        parent::setUp();
        $this->handler = new RecordingRequestHandler();
    }

    private function handledRequest(): ?ServerRequestInterface
    {
        return $this->handler->handledRequest;
    }

    /**
     * @param array<string, string> $queryParams
     */
    private function request(
        array $queryParams,
        string $navigationComponent = CategoryTreeConfiguration::NAVIGATION_COMPONENT,
        string $method = 'GET'
    ): ServerRequestInterface {
        $module = $this->createMock(ModuleInterface::class);
        $module->method('getNavigationComponent')->willReturn($navigationComponent);

        return (new ServerRequest('https://example.com/typo3/module/web/categories', $method))
            ->withQueryParams($queryParams)
            ->withAttribute('route', new Route('/module/web/categories', ['module' => $module]));
    }

    #[Test]
    public function redirectsWithoutThePageIdAndKeepsEveryOtherParameter(): void
    {
        $response = (new PageIdParameterRemover())->process(
            $this->request(['token' => 'abc', 'id' => '5', 'category' => '6']),
            $this->handler
        );

        self::assertSame(302, $response->getStatusCode());
        self::assertSame(
            'https://example.com/typo3/module/web/categories?token=abc&category=6',
            urldecode($response->getHeaderLine('location'))
        );
        self::assertNull($this->handledRequest(), 'The request must not reach the module validator.');
    }

    #[Test]
    public function passesRequestsWithoutAPageIdThrough(): void
    {
        $response = (new PageIdParameterRemover())->process(
            $this->request(['category' => '6']),
            $this->handler
        );

        self::assertSame(200, $response->getStatusCode());
        self::assertSame(['category' => '6'], $this->handledRequest()?->getQueryParams());
    }

    #[Test]
    public function leavesModulesWithAnotherNavigationComponentAlone(): void
    {
        $response = (new PageIdParameterRemover())->process(
            $this->request(['id' => '5'], '@typo3/backend/tree/page-tree-element'),
            $this->handler
        );

        self::assertSame(200, $response->getStatusCode());
        self::assertSame(['id' => '5'], $this->handledRequest()?->getQueryParams());
    }

    #[Test]
    public function leavesRequestsWithoutAModuleAlone(): void
    {
        $request = (new ServerRequest('https://example.com/typo3/ajax/something'))->withQueryParams(['id' => '5']);

        $response = (new PageIdParameterRemover())->process($request, $this->handler);

        self::assertSame(200, $response->getStatusCode());
        self::assertSame(['id' => '5'], $this->handledRequest()?->getQueryParams());
    }

    #[Test]
    public function stripsThePageIdOfASubmissionInsteadOfRedirectingIt(): void
    {
        // A redirect would drop the body, so a request that carries one is handled with the
        // parameter taken off instead.
        $response = (new PageIdParameterRemover())->process(
            $this->request(['id' => '5', 'category' => '6'], method: 'POST'),
            $this->handler
        );

        self::assertSame(200, $response->getStatusCode());
        self::assertSame(['category' => '6'], $this->handledRequest()?->getQueryParams());
    }
}

/**
 * Records the request it is handed, so a test can assert on what reached the rest of the
 * middleware stack.
 */
final class RecordingRequestHandler implements RequestHandlerInterface
{
    public ?ServerRequestInterface $handledRequest = null;

    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $this->handledRequest = $request;

        return new Response();
    }
}
