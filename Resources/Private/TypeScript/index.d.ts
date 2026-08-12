/**
* Minimal ambient declarations for the parts of the global TYPO3 object this
* extension touches. Add types as you use them.
*/
declare namespace TYPO3 {
  export let Backend: typeof import('@typo3/backend/viewport').default;
  export namespace ModuleMenu {
    export let App: typeof import('@typo3/backend/module-menu').default.App;
  }
  export const lang: {
    [key: string]: string
  };
  export namespace settings {
    export const ajaxUrls: {
      [key: string]: string
    };
  }
}

// type definition for global namespace object
interface Window {
  TYPO3: Partial<typeof TYPO3>;
  ModuleStateStorage: typeof import('@typo3/backend/storage/module-state-storage').ModuleStateStorage;
}
