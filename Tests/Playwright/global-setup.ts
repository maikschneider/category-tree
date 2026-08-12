import { resetCategories } from './support/typo3';

/**
* Puts the category tree into the known fixture state before the suite starts.
* Individual specs reset again in beforeEach; this covers a run that starts after
* someone has been clicking around in the backend by hand.
*/
export default async function globalSetup(): Promise<void> {
  resetCategories();
}
