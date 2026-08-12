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

import { html, LitElement, type PropertyValues, type TemplateResult } from 'lit';
import { customElement } from 'lit/decorators.js';
import { until } from 'lit/directives/until.js';
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
*/
const moduleStateType: string = 'category';

const TABLE: string = 'sys_category';

/**
* The tree payload carries a category type instead of the page tree's doktype.
*/
interface CategoryTreeNode extends TreeNodeInterface {
  categoryType?: number;
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
}

interface NodeEditOptions extends NodeChangeCommandDataInterface {
  command: TreeNodeCommandEnum.EDIT,
  title: string,
}

interface NodeNewOptions extends NodePositionOptions {
  command: TreeNodeCommandEnum.NEW,
  title: string,
  position: TreeNodePositionEnum,
  categoryType: number,
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
        const previousNode = this.getPreviousNode(target);
        targetUid = ((previousNode.depth === target.depth) ? '-' : '') + previousNode.identifier;
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
        // INSIDE — the new node becomes a child of the target
        parentUid = targetUid;
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
      if (typeField && newData.categoryType) {
        params += '&' + record + '[' + typeField + ']=' + encodeURIComponent(String(newData.categoryType));
      }
    } else if (data.command === TreeNodeCommandEnum.EDIT) {
      params = '&data[' + TABLE + '][' + data.node.identifier + '][title]=' + encodeURIComponent(data.title);
    } else if (data.command === TreeNodeCommandEnum.DELETE) {
      if (data.node.identifier === ModuleStateStorage.current(moduleStateType).identifier) {
        this.selectFirstNode();
      }
      params = '&cmd[' + TABLE + '][' + data.node.identifier + '][delete]=1';
    } else {
      params = 'cmd[' + TABLE + '][' + data.node.identifier + '][' + data.command + ']=' + targetUid;
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
        categoryType: (node as CategoryTreeNode).categoryType ?? 0,
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

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected override async handleNodeAdd(node: TreeNodeInterface, target: TreeNodeInterface, position: TreeNodePositionEnum): Promise<void> {
    this.updateComplete.then(() => {
      this.editNode(node);
    });
  }

  protected override handleNodeDelete(node: TreeNodeInterface): void {
    const options: NodeDeleteOptions = {
      node: node,
      command: TreeNodeCommandEnum.DELETE,
    };

    if (!this.settings.displayDeleteConfirmation) {
      this.sendChangeCommand(options);
      return;
    }

    const modal = Modal.confirm(
      TYPO3.lang['mess.delete.title'],
      TYPO3.lang['mess.delete'].replace('%s', options.node.name),
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
        this.sendChangeCommand(options);
      }
      modal.hideModal();
    });
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
  protected tree: EditableCategoryTree;

  protected override moduleStateType: string = moduleStateType;

  private configuration: Configuration = null;

  public override connectedCallback(): void {
    super.connectedCallback();
    document.addEventListener('typo3:categorytree:refresh', this.refresh);
    document.addEventListener('typo3:categorytree:selectFirstNode', this.selectFirstNode);
  }

  public override disconnectedCallback(): void {
    document.removeEventListener('typo3:categorytree:refresh', this.refresh);
    document.removeEventListener('typo3:categorytree:selectFirstNode', this.selectFirstNode);
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

  protected override firstUpdated(changedProperties: PropertyValues): void {
    super.firstUpdated(changedProperties);
    this.connectToolbar();
  }

  protected async renderTree(): Promise<TemplateResult> {
    const configuration = await this.getConfiguration();

    return html`
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
    `;
  }

  protected getConfiguration(): Promise<Configuration> {
    if (this.configuration !== null) {
      return Promise.resolve(this.configuration);
    }

    return (new AjaxRequest(top.TYPO3.settings.ajaxUrls.category_tree_configuration)).get()
      .then(async (response: AjaxResponse): Promise<Configuration> => {
        this.configuration = await response.resolve('json');
        return this.configuration;
      });
  }

  /**
  * The toolbar and the tree are siblings in the light DOM, so they are wired up
  * after the first render instead of via a template binding.
  */
  private connectToolbar(): void {
    const treeElement = this.querySelector('#typo3-categorytree-tree') as EditableCategoryTree;
    const toolbarElement = this.querySelector('#typo3-categorytree-toolbar') as CategoryTreeToolbar;
    if (treeElement && toolbarElement) {
      this.tree = treeElement;
      toolbarElement.tree = treeElement;
    }
  }

  private readonly refresh = (): void => {
    this.tree?.refreshOrFilterTree();
  };

  private readonly selectFirstNode = (): void => {
    this.tree?.selectFirstNode();
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
        if (key !== 'category' && !target.searchParams.has(key)) {
          target.searchParams.set(key, value);
        }
      });
    }

    if (node.identifier === '0') {
      target.searchParams.delete('category');
    } else {
      target.searchParams.set('category', node.identifier);
    }

    top.TYPO3.Backend.ContentContainer.setUrl(target.toString());
  };

  private readonly showContextMenu = (evt: CustomEvent): void => {
    const node = evt.detail.node as TreeNodeInterface;
    if (!node || node.identifier === '0' || !this.tree) {
      return;
    }

    ContextMenu.show(
      node.recordType,
      node.identifier,
      'tree',
      '',
      '',
      this.tree.getElementFromNode(node),
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
      categoryType: Number(item.nodeType) || 0,
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
