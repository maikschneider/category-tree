var P=Object.defineProperty;var _=Object.getOwnPropertyDescriptor;var f=(p,i,e,t)=>{for(var o=t>1?void 0:t?_(i,e):i,r=p.length-1,a;r>=0;r--)(a=p[r])&&(o=(t?a(i,e,o):a(o))||o);return t&&o&&P(i,e,o),o};import{html as T,LitElement as x}from"lit";import{customElement as N}from"lit/decorators.js";import{until as k}from"lit/directives/until.js";import{lll as m}from"@typo3/core/lit-helper.js";import w from"@typo3/core/ajax/ajax-request.js";import{ModuleUtility as O}from"@typo3/backend/module.js";import D from"@typo3/backend/context-menu.js";import C from"@typo3/backend/modal.js";import E from"@typo3/backend/severity.js";import{Tree as M}from"@typo3/backend/tree/tree.js";import{TreeNodeCommandEnum as s,TreeNodePositionEnum as l}from"@typo3/backend/tree/tree-node.js";import{TreeToolbar as S}from"@typo3/backend/tree/tree-toolbar.js";import{TreeModuleState as R}from"@typo3/backend/tree/tree-module-state.js";import{ModuleStateStorage as I}from"@typo3/backend/storage/module-state-storage.js";import{DataTransferTypes as v}from"@typo3/backend/enum/data-transfer-types.js";var Q="typo3-backend-navigation-component-category-tree",b="category",g="sys_category",u=class extends M{constructor(){super(...arguments);this.allowNodeEdit=!0;this.allowNodeDrag=!0;this.allowNodeSorting=!0}sendChangeCommand(e){let t="",o="0",r="0",a="0";if(e.target){let n=e.target;o=n.identifier;let d=n.parentIdentifier||"0";if(e.position===l.BEFORE){let c=this.getPreviousNode(n);o=(c.depth===n.depth?"-":"")+c.identifier,r=d,a=String(n.storagePid??0)}else e.position===l.AFTER?(o="-"+o,r=d,a="-"+n.identifier):(r=o,a=String(n.storagePid??0))}if(e.command===s.NEW){let n=e,d="data["+g+"]["+e.node.identifier+"]";t="&"+d+"[pid]="+encodeURIComponent(a)+"&"+d+"[parent]="+encodeURIComponent(r)+"&"+d+"[title]="+encodeURIComponent(n.title);let c=this.settings?.typeField;c&&n.categoryType&&(t+="&"+d+"["+c+"]="+encodeURIComponent(String(n.categoryType)))}else e.command===s.EDIT?t="&data["+g+"]["+e.node.identifier+"][title]="+encodeURIComponent(e.title):e.command===s.DELETE?(e.node.identifier===I.current(b).identifier&&this.selectFirstNode(),t="&cmd["+g+"]["+e.node.identifier+"][delete]=1"):t="cmd["+g+"]["+e.node.identifier+"]["+e.command+"]="+o;this.requestTreeUpdate(t).then(n=>{if(n&&n.hasErrors){this.errorNotification(n.messages);return}if(e.command===s.NEW){let d=this.getParentNode(e.node);d.loaded=!1,this.loadChildren(d)}else this.refreshOrFilterTree()})}async handleNodeEdit(e,t){if(e.__loading=!0,e.identifier.startsWith("NEW")){let o=this.getPreviousNode(e),r=e.depth===o.depth?l.AFTER:l.INSIDE;this.sendChangeCommand({command:s.NEW,node:e,title:t,position:r,target:o,categoryType:e.categoryType??0})}else this.sendChangeCommand({command:s.EDIT,node:e,title:t});e.__loading=!1}createDataTransferItemsFromNode(e){return[{type:v.treenode,data:this.getNodeTreeIdentifier(e)}]}async handleNodeAdd(e,t,o){this.updateComplete.then(()=>{this.editNode(e)})}handleNodeDelete(e){let t={node:e,command:s.DELETE};if(!this.settings.displayDeleteConfirmation){this.sendChangeCommand(t);return}let o=C.confirm(TYPO3.lang["mess.delete.title"],TYPO3.lang["mess.delete"].replace("%s",t.node.name),E.warning,[{text:TYPO3.lang["labels.cancel"]||"Cancel",active:!0,btnClass:"btn-default",name:"cancel"},{text:TYPO3.lang.delete||"Delete",btnClass:"btn-warning",name:"delete"}]);o.addEventListener("button.clicked",r=>{r.target.name==="delete"&&this.sendChangeCommand(t),o.hideModal()})}handleNodeMove(e,t,o){let r={node:e,target:t,position:o,command:s.MOVE},a;switch(o){case l.BEFORE:a=TYPO3.lang["mess.move_before"];break;case l.AFTER:a=TYPO3.lang["mess.move_after"];break;default:a=TYPO3.lang["mess.move_into"];break}a=a.replace("%s",e.name).replace("%s",t.name);let n=C.confirm(TYPO3.lang.move_page,a,E.warning,[{text:TYPO3.lang["labels.cancel"]||"Cancel",active:!0,btnClass:"btn-default",name:"cancel"},{text:TYPO3.lang["cm.copy"]||"Copy",btnClass:"btn-warning",name:"copy"},{text:TYPO3.lang["labels.move"]||"Move",btnClass:"btn-warning",name:"move"}]);n.addEventListener("button.clicked",d=>{let c=d.target.name;(c==="move"||c==="copy")&&(r.command=c==="move"?s.MOVE:s.COPY,this.sendChangeCommand(r)),n.hideModal()})}requestTreeUpdate(e){return new w(top.TYPO3.settings.ajaxUrls.record_process).post(e,{headers:{"Content-Type":"application/x-www-form-urlencoded","X-Requested-With":"XMLHttpRequest"}}).then(t=>t.resolve()).catch(t=>{this.errorNotification(t),this.loadData()})}};u=f([N("typo3-backend-navigation-component-category-tree-tree")],u);var F=`
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
`,y=class extends R(x){constructor(){super(...arguments);this.moduleStateType=b;this.configuration=null;this.refresh=()=>{this.tree?.refreshOrFilterTree()};this.selectFirstNode=()=>{this.tree?.selectFirstNode()};this.loadContent=e=>{let t=e.detail.node;if(!t?.checked||(I.updateWithTreeIdentifier(b,t.identifier,t.__treeIdentifier),e.detail.propagate===!1))return;let o=top.TYPO3.ModuleMenu.App,r=new URL(O.getFromName(o.getCurrentModule()).link,window.location.origin),a=new URL(top.TYPO3.Backend.ContentContainer.getUrl(),window.location.origin);a.pathname===r.pathname&&a.searchParams.forEach((n,d)=>{d!=="category"&&!r.searchParams.has(d)&&r.searchParams.set(d,n)}),t.identifier==="0"?r.searchParams.delete("category"):r.searchParams.set("category",t.identifier),top.TYPO3.Backend.ContentContainer.setUrl(r.toString())};this.showContextMenu=e=>{let t=e.detail.node;!t||t.identifier==="0"||!this.tree||D.show(t.recordType,t.identifier,"tree","","",this.tree.getElementFromNode(t),e.detail.originalEvent)}}connectedCallback(){super.connectedCallback(),document.addEventListener("typo3:categorytree:refresh",this.refresh),document.addEventListener("typo3:categorytree:selectFirstNode",this.selectFirstNode)}disconnectedCallback(){document.removeEventListener("typo3:categorytree:refresh",this.refresh),document.removeEventListener("typo3:categorytree:selectFirstNode",this.selectFirstNode),super.disconnectedCallback()}createRenderRoot(){return this}render(){return T`
      <style>${F}</style>
      <div id="typo3-categorytree" class="tree">
        ${k(this.renderTree(),"")}
      </div>
    `}firstUpdated(e){super.firstUpdated(e),this.connectToolbar()}async renderTree(){let e=await this.getConfiguration();return T`
      <typo3-backend-navigation-component-category-tree-toolbar
        id="typo3-categorytree-toolbar"
        .tree="${this.tree}"
      ></typo3-backend-navigation-component-category-tree-toolbar>
      <div id="typo3-categorytree-treeContainer" class="navigation-tree-container">
        <typo3-backend-navigation-component-category-tree-tree
          id="typo3-categorytree-tree"
          class="tree-wrapper"
          .setup=${e}
          @typo3:tree:node-selected=${this.loadContent}
          @typo3:tree:node-context=${this.showContextMenu}
          @typo3:tree:nodes-prepared=${this.selectActiveNodeInLoadedNodes}
        ></typo3-backend-navigation-component-category-tree-tree>
      </div>
    `}getConfiguration(){return this.configuration!==null?Promise.resolve(this.configuration):new w(top.TYPO3.settings.ajaxUrls.category_tree_configuration).get().then(async e=>(this.configuration=await e.resolve("json"),this.configuration))}connectToolbar(){let e=this.querySelector("#typo3-categorytree-tree"),t=this.querySelector("#typo3-categorytree-toolbar");e&&t&&(this.tree=e,t.tree=e)}};y=f([N("typo3-backend-navigation-component-category-tree")],y);var h=class extends S{firstUpdated(){this.resolveTree(),super.firstUpdated()}render(){return T`
      <div class="tree-toolbar">
        <div class="tree-toolbar__menu">
          <div class="tree-toolbar__search">
            <label for="toolbarSearch" class="visually-hidden">${m("labels.label.searchString")}</label>
            <input type="search" id="toolbarSearch" class="form-control form-control-sm search-input" placeholder="${m("tree.searchTermInfo")}">
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
              aria-label="${m("labels.openTreeOptionsMenu")}"
            >
              <typo3-backend-icon identifier="actions-menu-alternative" size="small"></typo3-backend-icon>
            </button>
            <ul class="dropdown-menu dropdown-menu-end">
              <li>
                <button class="dropdown-item" type="button" @click="${()=>this.tree?.refreshOrFilterTree()}">
                  <span class="dropdown-item-columns">
                    <span class="dropdown-item-column dropdown-item-column-icon" aria-hidden="true">
                      <typo3-backend-icon identifier="actions-refresh" size="small"></typo3-backend-icon>
                    </span>
                    <span class="dropdown-item-column dropdown-item-column-title">${m("labels.refresh")}</span>
                  </span>
                </button>
              </li>
              <li>
                <button class="dropdown-item" type="button" @click="${i=>this.collapseAll(i)}">
                  <span class="dropdown-item-columns">
                    <span class="dropdown-item-column dropdown-item-column-icon" aria-hidden="true">
                      <typo3-backend-icon identifier="apps-pagetree-category-collapse-all" size="small"></typo3-backend-icon>
                    </span>
                    <span class="dropdown-item-column dropdown-item-column-title">${m("labels.collapse")}</span>
                  </span>
                </button>
              </li>
            </ul>
          </div>
        </div>
      </div>
    `}renderDragNodes(){let i=this.tree?.settings;return i?.canModify?(i.categoryTypes??[]).map(e=>T`
      <div
        class="tree-toolbar__menuitem tree-toolbar__drag-node"
        title="${e.title}"
        draggable="true"
        data-tree-icon="${e.icon}"
        data-node-type="${e.nodeType}"
        aria-hidden="true"
        @dragstart="${t=>this.handleDragStart(t,e)}"
      >
        <typo3-backend-icon identifier="${e.icon}" size="small"></typo3-backend-icon>
      </div>
    `):[]}resolveTree(){if(!this.tree){let e=this.closest("typo3-backend-navigation-component-category-tree")?.querySelector("#typo3-categorytree-tree");e&&(this.tree=e)}return this.tree}handleDragStart(i,e){let t=this.resolveTree();if(!t)return;let o={__hidden:!1,__expanded:!1,__indeterminate:!1,__loading:!1,__processed:!1,__treeDragAction:"",__treeIdentifier:"",__treeParents:[""],__parents:[""],__x:0,__y:0,deletable:!1,depth:0,editable:!0,hasChildren:!1,icon:e.icon,overlayIcon:"",identifier:"NEW"+Math.floor(Math.random()*1e9).toString(16),loaded:!1,name:"",note:"",parentIdentifier:"",prefix:"",recordType:g,suffix:"",tooltip:"",type:"CategoryTreeItem",categoryType:Number(e.nodeType)||0,statusInformation:[],labels:[]};t.draggingNode=o,t.nodeDragMode=s.NEW,i.dataTransfer.clearData();let r={statusIconIdentifier:t.getNodeDragStatusIcon(),tooltipIconIdentifier:e.icon,tooltipLabel:e.title};i.dataTransfer.setData(v.dragTooltip,JSON.stringify(r)),i.dataTransfer.setData(v.newTreenode,JSON.stringify(o)),i.dataTransfer.effectAllowed="move"}};h=f([N("typo3-backend-navigation-component-category-tree-toolbar")],h);export{y as CategoryTreeNavigationComponent,h as CategoryTreeToolbar,u as EditableCategoryTree,Q as navigationComponentName};
