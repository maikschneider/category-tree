<?php

declare(strict_types=1);

namespace MaikSchneider\CategoryTree\Tests\Unit\Service;

use MaikSchneider\CategoryTree\Configuration\CategoryTreeConfiguration;
use MaikSchneider\CategoryTree\Domain\Repository\CategoryTreeRepository;
use MaikSchneider\CategoryTree\Service\EntryPointResolver;
use PHPUnit\Framework\Attributes\Test;
use TYPO3\TestingFramework\Core\Unit\UnitTestCase;

final class EntryPointResolverTest extends UnitTestCase
{
    /**
     * @param int[] $configured
     * @param int[] $existing
     */
    private function createSubject(array $configured, array $existing = []): EntryPointResolver
    {
        $configuration = $this->createMock(CategoryTreeConfiguration::class);
        $configuration->method('getEntryPoints')->willReturn($configured);
        $configuration->method('shouldShowHiddenCategories')->willReturn(true);

        $repository = $this->createMock(CategoryTreeRepository::class);
        $repository->method('findByUid')->willReturnCallback(
            static fn (int $uid): ?array => in_array($uid, $existing, true) ? ['uid' => $uid] : null
        );

        return new EntryPointResolver($configuration, $repository);
    }

    #[Test]
    public function returnsEmptyArrayWhenNothingIsConfigured(): void
    {
        self::assertSame([], $this->createSubject([])->resolve());
    }

    #[Test]
    public function keepsConfiguredEntryPointsThatExist(): void
    {
        self::assertSame([12, 48], $this->createSubject([12, 48], [12, 48])->resolve());
    }

    #[Test]
    public function dropsEntryPointsThatNoLongerExist(): void
    {
        self::assertSame([12], $this->createSubject([12, 48], [12])->resolve());
    }

    #[Test]
    public function preservesTheConfiguredOrder(): void
    {
        self::assertSame([48, 12], $this->createSubject([48, 12], [12, 48])->resolve());
    }

    /**
     * A stale UID must not silently blank out the whole navigation — an all-invalid list
     * falls back to "all top-level categories" rather than to an empty tree.
     */
    #[Test]
    public function returnsEmptyArrayWhenNoConfiguredEntryPointExists(): void
    {
        self::assertSame([], $this->createSubject([12, 48], [])->resolve());
    }
}
