/**
* Runs tsc over the extension sources.
*
* The TYPO3 core type definitions are consumed as raw .ts files (typo3-typescript-sources),
* which tsc type-checks along with our code and which do not compile cleanly on their own.
* Only diagnostics pointing at this extension's sources are treated as failures.
*/
import { spawnSync } from 'node:child_process';

const result = spawnSync('npx', ['tsc', '--noEmit', '--pretty', 'false'], { encoding: 'utf8' });
const ownDiagnostics = (result.stdout ?? '')
    .split('\n')
    .filter((line) => line.startsWith('Resources/Private/TypeScript'));

if (ownDiagnostics.length > 0) {
    console.error(ownDiagnostics.join('\n'));
    console.error(`\n${ownDiagnostics.length} type error(s) in Resources/Private/TypeScript.`);
    process.exit(1);
}

console.log('No type errors in Resources/Private/TypeScript.');
