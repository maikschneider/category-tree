<?php

declare(strict_types=1);

namespace MaikSchneider\CategoryTree\Event;

use Psr\Http\Message\ServerRequestInterface;

/**
 * Fired right before the category tree items are serialised to JSON.
 *
 * Listeners may add, remove, reorder or decorate items — for example to attach
 * statusInformation badges or extra labels coming from their own TCA columns.
 */
final class AfterCategoryTreeItemsPreparedEvent
{
    /**
     * @param array<int, array<string, mixed>> $items
     */
    public function __construct(
        private readonly ServerRequestInterface $request,
        private array $items,
    ) {
    }

    public function getRequest(): ServerRequestInterface
    {
        return $this->request;
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function getItems(): array
    {
        return $this->items;
    }

    /**
     * @param array<int, array<string, mixed>> $items
     */
    public function setItems(array $items): void
    {
        $this->items = $items;
    }
}
