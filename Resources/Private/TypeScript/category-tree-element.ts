/*
* This file is part of the TYPO3 CMS extension "category_tree".
*
* It is free software; you can redistribute it and/or modify it under
* the terms of the GNU General Public License, either version 2
* of the License, or any later version.
*
* For the full copyright and license information, please read the
* LICENSE.md file that was distributed with this source code.
*/

import { html, LitElement, type TemplateResult } from 'lit';
import { customElement } from 'lit/decorators.js';
import { until } from 'lit/directives/until.js';
import { keyed } from 'lit/directives/keyed.js';
import { lll } from '@typo3/core/lit-helper.js';
import AjaxRequest from '@typo3/core/ajax/ajax-request.js';
import { ModuleUtility } from '@typo3/backend/module.js';
import ContextMenu from '@typo3/backend/context-menu.js';
import Modal from '@typo3/backend/modal.js';
import Severity from '@typo3/backend/severity.js';
import { Tree } from '@typo3/backend/tree/tree.js';
import { TreeNodeCommandEnum, TreeNodePositionEnum, type TreeNodeInterface } from '@typo3/backend/tree/tree-node.js';
import { TreeToolbar } from '@typo3/backend/tree/tree-toolbar.js';
import { TreeModuleState } from '@typo3/backend/tree/tree-module-state.js';
import { ModuleStateStorage } from '@typo3/backend/storage/module-state-storage.js';
import { DataTransferTypes } from '@typo3/backend/enum/data-transfer-types.js';
import type { AjaxResponse } from '@typo3/core/ajax/ajax-response.js';
import type { DragTooltipMetadata } from '@typo3/backend/drag-tooltip.js';
import type { DataTransferStringItem } from '@typo3/backend/tree/tree.js';

/**
* Navigation component rendering an editable tree of sys_category records.
*
* Registered as a backend module's "navigationComponent" via
* "@maikschneider/category-tree/category-tree-element". Selecting a node reloads the
* content frame with a "category=<uid>" parameter; the consuming module decides what
* that means.
*
* Used as custom element via "<typo3-backend-navigation-component-category-tree>".
*/
export const navigationComponentName: string = 'typo3-backend-navigation-component-category-tree';

/**
* Session key the selected category is remembered under. Deliberately distinct from the
* page tree's "web" state so both trees can live side by side without overwriting each other.
*
* The hyphen is what keeps it out of the module URL: for a module with a navigation
* component, the module menu prepends "id=" from the state of the module name up to the
* first underscore (ModuleMenu.includeId), and the backend then validates that id as a page
* uid. A module named "category_tree" would read the state of type "category" — a category
* uid submitted as a page uid, which fails with "You don't have access to this page".
* Module identifiers cannot contain a hyphen, so this type is never derived from one.
*/
const moduleStateType: string = 'category-tree';

const TABLE: string = 'sys_category';

/**
* The tree payload carries a category type instead of the page tree's doktype.
*/
interface CategoryTreeNode extends TreeNodeInterface {
  // TCA type values may be strings, so this is never narrowed to a number.
  categoryType?: number | string;
  storagePid?: number;
}

interface CategoryType {
  nodeType: number | string;
  icon: string;
  title: string;
}

interface NodeChangeCommandDataInterface {
  command: TreeNodeCommandEnum,
  node: TreeNodeInterface,
  target?: TreeNodeInterface,
  position?: TreeNodePositionEnum,
  title?: string,
}

interface NodePositionOptions extends NodeChangeCommandDataInterface {
  command: TreeNodeCommandEnum.NEW | TreeNodeCommandEnum.COPY | TreeNodeCommandEnum.MOVE,
  target: TreeNodeInterface,
  position: TreeNodePositionEnum,
}

interface NodeDeleteOptions extends NodeChangeCommandDataInterface {
  command: TreeNodeCommandEnum.DELETE,
  descendants: string[],
}

interface NodeEditOptions extends NodeChangeCommandDataInterface {
  command: TreeNodeCommandEnum.EDIT,
  title: string,
}

interface NodeNewOptions extends NodePositionOptions {
  command: TreeNodeCommandEnum.NEW,
  title: string,
  position: TreeNodePositionEnum,
  categoryType: number | string,
}

/**
* Category tree with drag+drop, in-place editing and sorting. All write operations go
* through the core DataHandler endpoint, so record permissions stay enforced server side.
*/
@customElement('typo3-backend-navigation-component-category-tree-tree')
export class EditableCategoryTree extends Tree {
  protected override allowNodeEdit: boolean = true;
  protected override allowNodeDrag: boolean = true;
  protected override allowNodeSorting: boolean = true;

  public sendChangeCommand(data: NodeChangeCommandDataInterface): void {
    let params: string = '';
    let targetUid: string = '0';
    let parentUid: string = '0';
    let pidValue: string = '0';

    if (data.target) {
      const target = data.target as CategoryTreeNode;
      targetUid = target.identifier;
      const targetParentId = target.parentIdentifier || '0';

      if (data.position === TreeNodePositionEnum.BEFORE) {
        // Sorting is calculated per storage pid, so "before the target" is expressed as
        // "after the record rendered above it" — a sibling, or the parent itself when the
        // node becomes the first child.
        targetUid = '-' + this.getPreviousNode(target).identifier;
        parentUid = targetParentId;
        pidValue = String(target.storagePid ?? 0);
      } else if (data.position === TreeNodePositionEnum.AFTER) {
        targetUid = '-' + targetUid;
        parentUid = targetParentId;
        // A negative pid tells DataHandler to insert after this record and calculate the
        // sorting value itself. A positive pid would append at max_sorting+256 regardless
        // of any submitted sorting value, because "sorting" is not a TCA column and
        // fillInFieldArray skips it (see DataHandler::resolveSortingAndPidForNewRecord).
        pidValue = '-' + target.identifier;
      } else {
        // INSIDE — the node becomes a child of the target. A positive target is a storage
        // page, so DataHandler sorts the record to the top of it, the way the page tree
        // puts a node dropped onto a parent first among its children.
        targetUid = String(target.storagePid ?? 0);
        parentUid = target.identifier;
        pidValue = String(target.storagePid ?? 0);
      }
    }

    if (data.command === TreeNodeCommandEnum.NEW) {
      const newData = data as NodeNewOptions;
      const record = 'data[' + TABLE + '][' + data.node.identifier + ']';
      params = '&' + record + '[pid]=' + encodeURIComponent(pidValue) +
        '&' + record + '[parent]=' + encodeURIComponent(parentUid) +
        '&' + record + '[title]=' + encodeURIComponent(newData.title);
      const typeField = this.settings?.typeField;
      const categoryType = newData.categoryType;
      if (typeField && categoryType !== undefined && categoryType !== '') {
        params += '&' + record + '[' + typeField + ']=' + encodeURIComponent(String(categoryType));
      }
    } else if (data.command === TreeNodeCommandEnum.EDIT) {
      params = '&data[' + TABLE + '][' + data.node.identifier + '][title]=' + encodeURIComponent(data.title);
    } else if (data.command === TreeNodeCommandEnum.DELETE) {
      if (data.node.identifier === ModuleStateStorage.current(moduleStateType).identifier) {
        this.selectFirstNode();
      }
      // DataHandler only cascades a delete for pages, so the branch is deleted record by
      // record, deepest first, and the category itself last.
      params = [...(data as NodeDeleteOptions).descendants, data.node.identifier]
        .map((identifier: string): string => '&cmd[' + TABLE + '][' + identifier + '][delete]=1')
        .join('');
    } else {
      // Moving and copying are two operations for a parent-based tree: the DataHandler
      // command places the record on a storage page and gives it a sorting value, and the
      // extended "paste" form updates the parent field afterwards. For a copy that update
      // hits the new record, so its uid never has to travel to the client.
      const command = 'cmd[' + TABLE + '][' + data.node.identifier + '][' + data.command + ']';
      params = command + '[action]=paste' +
        '&' + command + '[target]=' + encodeURIComponent(targetUid) +
        '&' + command + '[update][parent]=' + encodeURIComponent(parentUid);
    }

    this.requestTreeUpdate(params).then((response) => {
      if (response && response.hasErrors) {
        this.errorNotification(response.messages);
        return;
      }
      if (data.command === TreeNodeCommandEnum.NEW) {
        const parentNode = this.getParentNode(data.node);
        parentNode.loaded = false;
        this.loadChildren(parentNode);
      } else {
        this.refreshOrFilterTree();
      }
    });
  }

  protected override async handleNodeEdit(node: TreeNodeInterface, newName: string): Promise<void> {
    node.__loading = true;

    if (node.identifier.startsWith('NEW')) {
      const target = this.getPreviousNode(node);
      const position = (node.depth === target.depth) ? TreeNodePositionEnum.AFTER : TreeNodePositionEnum.INSIDE;
      this.sendChangeCommand({
        command: TreeNodeCommandEnum.NEW,
        node: node,
        title: newName,
        position: position,
        target: target,
        categoryType: (node as CategoryTreeNode).categoryType ?? '',
      } as NodeNewOptions);
    } else {
      this.sendChangeCommand({
        command: TreeNodeCommandEnum.EDIT,
        node: node,
        title: newName,
      } as NodeEditOptions);
    }

    node.__loading = false;
  }

  protected override createDataTransferItemsFromNode(node: TreeNodeInterface): DataTransferStringItem[] {
    return [
      {
        type: DataTransferTypes.treenode,
        data: this.getNodeTreeIdentifier(node),
      },
    ];
  }

  /**
   * Prevents the core Tree's page wizard from opening when a new category type is
   * dropped onto the tree, and starts inline editing instead.
   *
   * The core base class unconditionally calls openPageWizardModal for any drop
   * carrying DataTransferTypes.newTreenode, passing r.doktype — but a category
   * node carries categoryType, not doktype, so the wizard opens with undefined
   * data and fails to fetch available page types.
   */
  protected override handleNodeDrop(event: DragEvent): boolean {
    this.cleanDrag();

    if (event.dataTransfer.types.includes(DataTransferTypes.treenode)) {
      return super.handleNodeDrop(event);
    }

    if (event.dataTransfer.types.includes(DataTransferTypes.newTreenode)) {
      event.preventDefault();
      let target = this.getNodeFromDragEvent(event);
      if (target === null) {
        return false;
      }
      const newNode: TreeNodeInterface = JSON.parse(event.dataTransfer.getData(DataTransferTypes.newTreenode));
      if (this.nodeDragPosition === TreeNodePositionEnum.AFTER) {
        this.addNode(newNode, target, TreeNodePositionEnum.INSIDE);
      } else if (this.nodeDragPosition === TreeNodePositionEnum.BEFORE) {
        const previous = this.getPreviousNode(target);
        const position = previous.depth === target.depth ? TreeNodePositionEnum.AFTER : TreeNodePositionEnum.INSIDE;
        this.addNode(newNode, previous, position);
      } else {
        this.addNode(newNode, target, TreeNodePositionEnum.INSIDE);
      }
      this.nodeDragMode = null;
      this.nodeDragPosition = null;
      return true;
    }

    return false;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected override async handleNodeAdd(node: TreeNodeInterface, target: TreeNodeInterface, position: TreeNodePositionEnum): Promise<void> {
    this.updateComplete.then(() => {
      this.editNode(node);
    });
  }

  protected override handleNodeDelete(node: TreeNodeInterface): void {
    const deleteBranch = (): void => {
      this.fetchDescendants(node.identifier)
        .then((descendants: string[]): void => {
          this.sendChangeCommand({
            node: node,
            command: TreeNodeCommandEnum.DELETE,
            descendants: descendants,
          } as NodeDeleteOptions);
        })
        .catch((error): void => this.errorNotification(error));
    };

    if (!this.settings.displayDeleteConfirmation) {
      deleteBranch();
      return;
    }

    const modal = Modal.confirm(
      TYPO3.lang['mess.delete.title'],
      TYPO3.lang['mess.delete'].replace('%s', node.name),
      Severity.warning,
      [
        {
          text: TYPO3.lang['labels.cancel'] || 'Cancel',
          active: true,
          btnClass: 'btn-default',
          name: 'cancel',
        },
        {
          text: TYPO3.lang.delete || 'Delete',
          btnClass: 'btn-warning',
          name: 'delete',
        },
      ]
    );
    modal.addEventListener('button.clicked', (e: Event): void => {
      if ((e.target as HTMLInputElement).name === 'delete') {
        deleteBranch();
      }
      modal.hideModal();
    });
  }

  /**
  * The categories below a node, deepest first. Children are only known to the client once
  * they have been expanded, so the server is asked for the whole branch.
  */
  private async fetchDescendants(identifier: string): Promise<string[]> {
    const url = this.settings?.descendantsUrl;
    if (!url || identifier.startsWith('NEW')) {
      return [];
    }

    const response = await (new AjaxRequest(url)).withQueryArguments({ identifier }).get();

    return (await response.resolve('json')).descendants ?? [];
  }

  protected override handleNodeMove(node: TreeNodeInterface, target: TreeNodeInterface, position: TreeNodePositionEnum): void {
    const options: NodePositionOptions = {
      node: node,
      target: target,
      position: position,
      command: TreeNodeCommandEnum.MOVE,
    };

    let modalText: string;
    switch (position) {
      case TreeNodePositionEnum.BEFORE:
        modalText = TYPO3.lang['mess.move_before'];
        break;
      case TreeNodePositionEnum.AFTER:
        modalText = TYPO3.lang['mess.move_after'];
        break;
      default:
        modalText = TYPO3.lang['mess.move_into'];
        break;
    }
    modalText = modalText.replace('%s', node.name).replace('%s', target.name);

    const modal = Modal.confirm(
      TYPO3.lang.move_page,
      modalText,
      Severity.warning,
      [
        {
          text: TYPO3.lang['labels.cancel'] || 'Cancel',
          active: true,
          btnClass: 'btn-default',
          name: 'cancel',
        },
        {
          text: TYPO3.lang['cm.copy'] || 'Copy',
          btnClass: 'btn-warning',
          name: 'copy',
        },
        {
          text: TYPO3.lang['labels.move'] || 'Move',
          btnClass: 'btn-warning',
          name: 'move',
        },
      ]
    );

    modal.addEventListener('button.clicked', (e: Event): void => {
      const name = (e.target as HTMLInputElement).name;
      if (name === 'move' || name === 'copy') {
        options.command = name === 'move' ? TreeNodeCommandEnum.MOVE : TreeNodeCommandEnum.COPY;
        this.sendChangeCommand(options);
      }
      modal.hideModal();
    });
  }

  /**
  * A request the tree replaced with a newer one — a search term typed over the previous
  * one, a reload triggered while the last was still running — rejects as aborted. That is
  * the component working as intended, so it stays silent instead of alarming the editor.
  *
  * Core guards its own filter request this way; every other path (its node fetches, our
  * writes and the descendants lookup) reports whatever it is handed, which is why the guard
  * lives here, where all of them end up.
  */
  public override errorNotification(error: any = null): void {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return;
    }

    super.errorNotification(error);
  }

  private requestTreeUpdate(params: string): Promise<any> {
    return (new AjaxRequest(top.TYPO3.settings.ajaxUrls.record_process))
      .post(params, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Requested-With': 'XMLHttpRequest' },
      })
      .then((response) => response.resolve())
      .catch((error) => {
        this.errorNotification(error);
        this.loadData();
      });
  }
}

interface Configuration {
  [keys: string]: any;
}

/**
* The backend gives its own tree components their box model by custom element name
* (see the rules for typo3-backend-component-page-browser and friends). Our elements are
* named differently, so without this they fall back to display:inline and collapse to a
* zero-height box — the tree loads its nodes and renders nothing visible.
*
* These live in the light DOM alongside the component rather than in a stylesheet, so the
* component stays a single self-contained module for consuming extensions to point at.
*/
const componentStyles: string = `
  typo3-backend-navigation-component-category-tree {
    display: flex;
    flex-direction: column;
    height: 100%;
  }
  typo3-backend-navigation-component-category-tree-toolbar {
    flex: 0 0 auto;
  }
  typo3-backend-navigation-component-category-tree-tree {
    display: block;
    flex: 1 1 auto;
    min-height: 0;
    width: 100%;
  }
  #typo3-categorytree,
  #typo3-categorytree-treeContainer {
    display: flex;
    flex-direction: column;
    flex: 1 1 auto;
    min-height: 0;
  }
`;

@customElement('typo3-backend-navigation-component-category-tree')
export class CategoryTreeNavigationComponent extends TreeModuleState(LitElement) {
  protected tree: EditableCategoryTree | null = null;

  protected override moduleStateType: string = moduleStateType;

  private configuration: Configuration = null;

  private configurationModule: string | null = null;

  private treeTriggeredModuleLoad: boolean = false;

  public override connectedCallback(): void {
    super.connectedCallback();
    document.addEventListener('typo3:categorytree:refresh', this.refresh);
    document.addEventListener('typo3:categorytree:selectFirstNode', this.selectFirstNode);
    document.addEventListener('typo3:datahandler:process', this.refreshOnCategoryWrite);
    document.addEventListener('typo3-module-loaded', this.refreshOnModuleLoad);
  }

  public override disconnectedCallback(): void {
    document.removeEventListener('typo3:categorytree:refresh', this.refresh);
    document.removeEventListener('typo3:categorytree:selectFirstNode', this.selectFirstNode);
    document.removeEventListener('typo3:datahandler:process', this.refreshOnCategoryWrite);
    document.removeEventListener('typo3-module-loaded', this.refreshOnModuleLoad);
    super.disconnectedCallback();
  }

  // The backend styles the navigation area globally, so no shadow DOM here.
  protected override createRenderRoot(): HTMLElement | ShadowRoot {
    return this;
  }

  protected override render(): TemplateResult {
    return html`
      <style>${componentStyles}</style>
      <div id="typo3-categorytree" class="tree">
        ${until(this.renderTree(), '')}
      </div>
    `;
  }

  protected async renderTree(): Promise<TemplateResult> {
    const configuration = await this.getConfiguration();

    // The backend keeps one navigation component per component name and hands it to every
    // module that declares it, while the tree reads its setup only once, when it is first
    // updated. Keying the elements on the module therefore replaces them on a switch,
    // instead of leaving the previous module's settings and endpoints in place.
    return html`${keyed(this.configurationModule ?? '', html`
      <typo3-backend-navigation-component-category-tree-toolbar
        id="typo3-categorytree-toolbar"
        .tree="${this.tree}"
      ></typo3-backend-navigation-component-category-tree-toolbar>
      <div id="typo3-categorytree-treeContainer" class="navigation-tree-container">
        <typo3-backend-navigation-component-category-tree-tree
          id="typo3-categorytree-tree"
          class="tree-wrapper"
          .setup=${configuration}
          @typo3:tree:node-selected=${this.loadContent}
          @typo3:tree:node-context=${this.showContextMenu}
          @typo3:tree:nodes-prepared=${this.selectActiveNodeInLoadedNodes}
        ></typo3-backend-navigation-component-category-tree-tree>
      </div>
    `)}`;
  }

  protected getConfiguration(): Promise<Configuration> {
    const module = this.getCurrentModuleIdentifier();
    if (this.configuration !== null && this.configurationModule === module) {
      return Promise.resolve(this.configuration);
    }
    this.configurationModule = module;

    // Settings are resolved per module, and the endpoints are routes of their own with no
    // knowledge of the module they are called from — so the module travels with this one
    // request and comes back baked into the URLs of the others.
    return (new AjaxRequest(top.TYPO3.settings.ajaxUrls.category_tree_configuration))
      .withQueryArguments({ module: module })
      .get()
      .then(async (response: AjaxResponse): Promise<Configuration> => {
        this.configuration = await response.resolve('json');
        return this.configuration;
      });
  }

  private getCurrentModuleIdentifier(): string {
    return top.TYPO3.ModuleMenu?.App?.getCurrentModule() ?? '';
  }

  /**
  * The tree is rendered from a promise, so it does not exist yet when this component
  * first updates. Every consumer looks it up on demand instead of relying on a binding
  * that would have to be made before the element is in the DOM.
  */
  protected resolveTree(): EditableCategoryTree | null {
    if (!this.tree) {
      this.tree = this.querySelector('#typo3-categorytree-tree');
      const toolbarElement = this.querySelector<CategoryTreeToolbar>('#typo3-categorytree-toolbar');
      if (this.tree && toolbarElement) {
        toolbarElement.tree = this.tree;
      }
    }

    return this.tree;
  }

  private readonly refresh = (): void => {
    this.resolveTree()?.refreshOrFilterTree();
  };

  private readonly selectFirstNode = (): void => {
    this.resolveTree()?.selectFirstNode();
  };

  /**
  * Deleting, copying or pasting a category from the context menu goes through the shared
  * DataHandler endpoint, which announces itself for every table. Only ours concerns us.
  */
  private readonly refreshOnCategoryWrite = (event: CustomEvent): void => {
    if (event.detail?.payload?.table === TABLE) {
      this.resolveTree()?.refreshOrFilterTree();
    }
  };

  /**
  * Hiding a category has no event of its own: the context menu writes the record by
  * navigating the content area, so a module that finished loading is the only signal that
  * something may have changed. Navigations the tree caused itself are skipped, or every
  * click on a node would reload the tree it was just clicked in.
  */
  private readonly refreshOnModuleLoad = (): void => {
    const treeTriggered = this.treeTriggeredModuleLoad;
    this.treeTriggeredModuleLoad = false;

    // Settings are resolved per module, so a module the tree was not built for needs a
    // fresh tree rather than a reload of the nodes of the previous one.
    if (this.getCurrentModuleIdentifier() !== this.configurationModule) {
      this.configuration = null;
      this.tree = null;
      this.requestUpdate();
      return;
    }

    if (treeTriggered) {
      return;
    }

    this.resolveTree()?.refreshOrFilterTree();
  };

  /**
  * Reloads the content frame for the selected category.
  *
  * The current module keeps its own query parameters; only "category" is (re)written.
  * The synthetic root node clears the parameter, which consuming modules should read
  * as "no category filter".
  */
  private readonly loadContent = (evt: CustomEvent): void => {
    const node = evt.detail.node as TreeNodeInterface;
    if (!node?.checked) {
      return;
    }

    ModuleStateStorage.updateWithTreeIdentifier(moduleStateType, node.identifier, node.__treeIdentifier);

    if (evt.detail.propagate === false) {
      return;
    }

    const moduleMenu = top.TYPO3.ModuleMenu.App;
    const target = new URL(
      ModuleUtility.getFromName(moduleMenu.getCurrentModule()).link,
      window.location.origin
    );

    const current = new URL(top.TYPO3.Backend.ContentContainer.getUrl(), window.location.origin);
    if (current.pathname === target.pathname) {
      current.searchParams.forEach((value: string, key: string): void => {
        // "id" is a page uid to the backend and is never ours to carry: once one arrives,
        // copying it forward would attach it to every following selection.
        if (key !== 'category' && key !== 'id' && !target.searchParams.has(key)) {
          target.searchParams.set(key, value);
        }
      });
    }

    if (node.identifier === '0') {
      target.searchParams.delete('category');
    } else {
      target.searchParams.set('category', node.identifier);
    }

    this.treeTriggeredModuleLoad = true;
    top.TYPO3.Backend.ContentContainer.setUrl(target.toString());
  };

  private readonly showContextMenu = (evt: CustomEvent): void => {
    const node = evt.detail.node as TreeNodeInterface;
    const tree = this.resolveTree();
    if (!node || node.identifier === '0' || !tree) {
      return;
    }

    ContextMenu.show(
      node.recordType,
      node.identifier,
      'tree',
      '',
      '',
      tree.getElementFromNode(node),
      evt.detail.originalEvent as PointerEvent
    );
  };
}

/**
* Adds the "drag a new category into the tree" items to the stock tree toolbar.
*/
@customElement('typo3-backend-navigation-component-category-tree-toolbar')
export class CategoryTreeToolbar extends TreeToolbar {
  // Narrows the inherited reactive property; assignment still goes through Lit's accessor.
  declare tree: EditableCategoryTree;

  protected override firstUpdated(): void {
    this.resolveTree();
    super.firstUpdated();
  }

  protected override render(): TemplateResult {
    return html`
      <div class="tree-toolbar">
        <div class="tree-toolbar__menu">
          <div class="tree-toolbar__search">
            <label for="toolbarSearch" class="visually-hidden">${lll('labels.label.searchString')}</label>
            <input type="search" id="toolbarSearch" class="form-control form-control-sm search-input" placeholder="${lll('tree.searchTermInfo')}">
          </div>
        </div>
        <div class="tree-toolbar__submenu">
          ${this.renderDragNodes()}
          <div class="dropdown ms-auto">
            <button
              type="button"
              class="tree-toolbar__menuitem dropdown-toggle dropdown-toggle-no-chevron"
              data-bs-toggle="dropdown"
              aria-expanded="false"
              aria-label="${lll('labels.openTreeOptionsMenu')}"
            >
              <typo3-backend-icon identifier="actions-menu-alternative" size="small"></typo3-backend-icon>
            </button>
            <ul class="dropdown-menu dropdown-menu-end">
              <li>
                <button class="dropdown-item" type="button" @click="${() => this.tree?.refreshOrFilterTree()}">
                  <span class="dropdown-item-columns">
                    <span class="dropdown-item-column dropdown-item-column-icon" aria-hidden="true">
                      <typo3-backend-icon identifier="actions-refresh" size="small"></typo3-backend-icon>
                    </span>
                    <span class="dropdown-item-column dropdown-item-column-title">${lll('labels.refresh')}</span>
                  </span>
                </button>
              </li>
              <li>
                <button class="dropdown-item" type="button" @click="${(evt: MouseEvent) => this.collapseAll(evt)}">
                  <span class="dropdown-item-columns">
                    <span class="dropdown-item-column dropdown-item-column-icon" aria-hidden="true">
                      <typo3-backend-icon identifier="apps-pagetree-category-collapse-all" size="small"></typo3-backend-icon>
                    </span>
                    <span class="dropdown-item-column dropdown-item-column-title">${lll('labels.collapse')}</span>
                  </span>
                </button>
              </li>
            </ul>
          </div>
        </div>
      </div>
    `;
  }

  protected renderDragNodes(): TemplateResult[] {
    const settings = this.tree?.settings;
    if (!settings?.canModify) {
      return [];
    }

    return (settings.categoryTypes as CategoryType[] ?? []).map((item: CategoryType) => html`
      <div
        class="tree-toolbar__menuitem tree-toolbar__drag-node"
        title="${item.title}"
        draggable="true"
        data-tree-icon="${item.icon}"
        data-node-type="${item.nodeType}"
        aria-hidden="true"
        @dragstart="${(event: DragEvent) => this.handleDragStart(event, item)}"
      >
        <typo3-backend-icon identifier="${item.icon}" size="small"></typo3-backend-icon>
      </div>
    `);
  }

  /**
  * The toolbar is rendered before its sibling tree is assigned, so it looks the tree
  * up from the surrounding navigation component when the binding has not arrived yet.
  */
  protected resolveTree(): EditableCategoryTree {
    if (!this.tree) {
      const parent = this.closest('typo3-backend-navigation-component-category-tree');
      const treeElement = parent?.querySelector('#typo3-categorytree-tree') as EditableCategoryTree;
      if (treeElement) {
        this.tree = treeElement;
      }
    }

    return this.tree;
  }

  protected handleDragStart(event: DragEvent, item: CategoryType): void {
    const tree = this.resolveTree();
    if (!tree) {
      return;
    }

    const newNode: CategoryTreeNode = {
      __hidden: false,
      __expanded: false,
      __indeterminate: false,
      __loading: false,
      __processed: false,
      __treeDragAction: '',
      __treeIdentifier: '',
      __treeParents: [''],
      __parents: [''],
      __x: 0,
      __y: 0,
      deletable: false,
      depth: 0,
      editable: true,
      hasChildren: false,
      icon: item.icon,
      overlayIcon: '',
      identifier: 'NEW' + Math.floor(Math.random() * 1000000000).toString(16),
      loaded: false,
      name: '',
      note: '',
      parentIdentifier: '',
      prefix: '',
      recordType: TABLE,
      suffix: '',
      tooltip: '',
      type: 'CategoryTreeItem',
      categoryType: item.nodeType,
      statusInformation: [],
      labels: [],
    };

    tree.draggingNode = newNode;
    tree.nodeDragMode = TreeNodeCommandEnum.NEW;

    event.dataTransfer.clearData();
    const metadata: DragTooltipMetadata = {
      statusIconIdentifier: tree.getNodeDragStatusIcon(),
      tooltipIconIdentifier: item.icon,
      tooltipLabel: item.title,
    };
    event.dataTransfer.setData(DataTransferTypes.dragTooltip, JSON.stringify(metadata));
    event.dataTransfer.setData(DataTransferTypes.newTreenode, JSON.stringify(newNode));
    event.dataTransfer.effectAllowed = 'move';
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'typo3-backend-navigation-component-category-tree': CategoryTreeNavigationComponent;
    'typo3-backend-navigation-component-category-tree-tree': EditableCategoryTree;
    'typo3-backend-navigation-component-category-tree-toolbar': CategoryTreeToolbar;
  }
}
