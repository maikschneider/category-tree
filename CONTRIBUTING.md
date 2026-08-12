# Contributing

Thanks for taking the time.

## Getting set up

```bash
ddev start
ddev composer install
npm install
```

## Before opening a pull request

```bash
ddev composer sca          # php-cs-fixer, phpstan, editorconfig, xliff
ddev composer test:unit
ddev composer test:functional
npm run tsc                # type check
npm run build              # rebuild the committed JavaScript bundle
```

The compiled `Resources/Public/JavaScript/category-tree-element.js` is committed, because
TYPO3 serves it directly. CI fails if it is out of sync with the TypeScript source, so
run `npm run build` whenever you touch `Resources/Private/TypeScript`.

## Conventions

- TYPO3 Coding Guidelines; `php-cs-fixer` is the arbiter.
- PHPStan level 7. Do not grow `phpstan-baseline.neon` — fix the finding instead.
- New user-facing strings go into both `locallang*.xlf` and their `de.` counterparts.
- Every behavioural change needs a test. Repository and controller logic is covered by
  functional tests; configuration and resolution logic by unit tests.
