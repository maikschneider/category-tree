var O=Object.defineProperty;var _=Object.getOwnPropertyDescriptor;var f=(m,i,e,t)=>{for(var o=t>1?void 0:t?_(i,e):i,r=m.length-1,a;r>=0;r--)(a=m[r])&&(o=(t?a(i,e,o):a(o))||o);return t&&o&&O(i,e,o),o};import{html as T,LitElement as x}from"lit";import{customElement as E}from"lit/decorators.js";import{until as D}from"lit/directives/until.js";import{lll as g}from"@typo3/core/lit-helper.js";import b from"@typo3/core/ajax/ajax-request.js";import{ModuleUtility as k}from"@typo3/backend/module.js";import M from"@typo3/backend/context-menu.js";import w from"@typo3/backend/modal.js";import I from"@typo3/backend/severity.js";import{Tree as L}from"@typo3/backend/tree/tree.js";import{TreeNodeCommandEnum as d,TreeNodePositionEnum as l}from"@typo3/backend/tree/tree-node.js";import{TreeToolbar as S}from"@typo3/backend/tree/tree-toolbar.js";import{TreeModuleState as R}from"@typo3/backend/tree/tree-module-state.js";import{ModuleStateStorage as P}from"@typo3/backend/storage/module-state-storage.js";import{DataTransferTypes as N}from"@typo3/backend/enum/data-transfer-types.js";var Z="typo3-backend-navigation-component-category-tree",C="category",p="sys_category",u=class extends L{constructor(){super(...arguments);this.allowNodeEdit=!0;this.allowNodeDrag=!0;this.allowNodeSorting=!0}sendChangeCommand(e){let t="",o="0",r="0",a="0";if(e.target){let n=e.target;o=n.identifier;let s=n.parentIdentifier||"0";e.position===l.BEFORE?(o="-"+this.getPreviousNode(n).identifier,r=s,a=String(n.storagePid??0)):e.position===l.AFTER?(o="-"+o,r=s,a="-"+n.identifier):(o=String(n.storagePid??0),r=n.identifier,a=String(n.storagePid??0))}if(e.command===d.NEW){let n=e,s="data["+p+"]["+e.node.identifier+"]";t="&"+s+"[pid]="+encodeURIComponent(a)+"&"+s+"[parent]="+encodeURIComponent(r)+"&"+s+"[title]="+encodeURIComponent(n.title);let c=this.settings?.typeField,v=n.categoryType;c&&v!==void 0&&v!==""&&(t+="&"+s+"["+c+"]="+encodeURIComponent(String(v)))}else if(e.command===d.EDIT)t="&data["+p+"]["+e.node.identifier+"][title]="+encodeURIComponent(e.title);else if(e.command===d.DELETE)e.node.identifier===P.current(C).identifier&&this.selectFirstNode(),t=[...e.descendants,e.node.identifier].map(n=>"&cmd["+p+"]["+n+"][delete]=1").join("");else{let n="cmd["+p+"]["+e.node.identifier+"]["+e.command+"]";t=n+"[action]=paste&"+n+"[target]="+encodeURIComponent(o)+"&"+n+"[update][parent]="+encodeURIComponent(r)}this.requestTreeUpdate(t).then(n=>{if(n&&n.hasErrors){this.errorNotification(n.messages);return}if(e.command===d.NEW){let s=this.getParentNode(e.node);s.loaded=!1,this.loadChildren(s)}else this.refreshOrFilterTree()})}async handleNodeEdit(e,t){if(e.__loading=!0,e.identifier.startsWith("NEW")){let o=this.getPreviousNode(e),r=e.depth===o.depth?l.AFTER:l.INSIDE;this.sendChangeCommand({command:d.NEW,node:e,title:t,position:r,target:o,categoryType:e.categoryType??""})}else this.sendChangeCommand({command:d.EDIT,node:e,title:t});e.__loading=!1}createDataTransferItemsFromNode(e){return[{type:N.treenode,data:this.getNodeTreeIdentifier(e)}]}async handleNodeAdd(e,t,o){this.updateComplete.then(()=>{this.editNode(e)})}handleNodeDelete(e){let t=()=>{this.fetchDescendants(e.identifier).then(r=>{this.sendChangeCommand({node:e,command:d.DELETE,descendants:r})}).catch(r=>this.errorNotification(r))};if(!this.settings.displayDeleteConfirmation){t();return}let o=w.confirm(TYPO3.lang["mess.delete.title"],TYPO3.lang["mess.delete"].replace("%s",e.name),I.warning,[{text:TYPO3.lang["labels.cancel"]||"Cancel",active:!0,btnClass:"btn-default",name:"cancel"},{text:TYPO3.lang.delete||"Delete",btnClass:"btn-warning",name:"delete"}]);o.addEventListener("button.clicked",r=>{r.target.name==="delete"&&t(),o.hideModal()})}async fetchDescendants(e){let t=this.settings?.descendantsUrl;return!t||e.startsWith("NEW")?[]:(await(await new b(t).withQueryArguments({identifier:e}).get()).resolve("json")).descendants??[]}handleNodeMove(e,t,o){let r={node:e,target:t,position:o,command:d.MOVE},a;switch(o){case l.BEFORE:a=TYPO3.lang["mess.move_before"];break;case l.AFTER:a=TYPO3.lang["mess.move_after"];break;default:a=TYPO3.lang["mess.move_into"];break}a=a.replace("%s",e.name).replace("%s",t.name);let n=w.confirm(TYPO3.lang.move_page,a,I.warning,[{text:TYPO3.lang["labels.cancel"]||"Cancel",active:!0,btnClass:"btn-default",name:"cancel"},{text:TYPO3.lang["cm.copy"]||"Copy",btnClass:"btn-warning",name:"copy"},{text:TYPO3.lang["labels.move"]||"Move",btnClass:"btn-warning",name:"move"}]);n.addEventListener("button.clicked",s=>{let c=s.target.name;(c==="move"||c==="copy")&&(r.command=c==="move"?d.MOVE:d.COPY,this.sendChangeCommand(r)),n.hideModal()})}requestTreeUpdate(e){return new b(top.TYPO3.settings.ajaxUrls.record_process).post(e,{headers:{"Content-Type":"application/x-www-form-urlencoded","X-Requested-With":"XMLHttpRequest"}}).then(t=>t.resolve()).catch(t=>{this.errorNotification(t),this.loadData()})}};u=f([E("typo3-backend-navigation-component-category-tree-tree")],u);var F=`
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
`,y=class extends R(x){constructor(){super(...arguments);this.tree=null;this.moduleStateType=C;this.configuration=null;this.treeTriggeredModuleLoad=!1;this.refresh=()=>{this.resolveTree()?.refreshOrFilterTree()};this.selectFirstNode=()=>{this.resolveTree()?.selectFirstNode()};this.refreshOnCategoryWrite=e=>{e.detail?.payload?.table===p&&this.resolveTree()?.refreshOrFilterTree()};this.refreshOnModuleLoad=()=>{if(this.treeTriggeredModuleLoad){this.treeTriggeredModuleLoad=!1;return}this.resolveTree()?.refreshOrFilterTree()};this.loadContent=e=>{let t=e.detail.node;if(!t?.checked||(P.updateWithTreeIdentifier(C,t.identifier,t.__treeIdentifier),e.detail.propagate===!1))return;let o=top.TYPO3.ModuleMenu.App,r=new URL(k.getFromName(o.getCurrentModule()).link,window.location.origin),a=new URL(top.TYPO3.Backend.ContentContainer.getUrl(),window.location.origin);a.pathname===r.pathname&&a.searchParams.forEach((n,s)=>{s!=="category"&&!r.searchParams.has(s)&&r.searchParams.set(s,n)}),t.identifier==="0"?r.searchParams.delete("category"):r.searchParams.set("category",t.identifier),this.treeTriggeredModuleLoad=!0,top.TYPO3.Backend.ContentContainer.setUrl(r.toString())};this.showContextMenu=e=>{let t=e.detail.node,o=this.resolveTree();!t||t.identifier==="0"||!o||M.show(t.recordType,t.identifier,"tree","","",o.getElementFromNode(t),e.detail.originalEvent)}}connectedCallback(){super.connectedCallback(),document.addEventListener("typo3:categorytree:refresh",this.refresh),document.addEventListener("typo3:categorytree:selectFirstNode",this.selectFirstNode),document.addEventListener("typo3:datahandler:process",this.refreshOnCategoryWrite),document.addEventListener("typo3-module-loaded",this.refreshOnModuleLoad)}disconnectedCallback(){document.removeEventListener("typo3:categorytree:refresh",this.refresh),document.removeEventListener("typo3:categorytree:selectFirstNode",this.selectFirstNode),document.removeEventListener("typo3:datahandler:process",this.refreshOnCategoryWrite),document.removeEventListener("typo3-module-loaded",this.refreshOnModuleLoad),super.disconnectedCallback()}createRenderRoot(){return this}render(){return T`
      <style>${F}</style>
      <div id="typo3-categorytree" class="tree">
        ${D(this.renderTree(),"")}
      </div>
    `}async renderTree(){let e=await this.getConfiguration();return T`
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
    `}getConfiguration(){return this.configuration!==null?Promise.resolve(this.configuration):new b(top.TYPO3.settings.ajaxUrls.category_tree_configuration).get().then(async e=>(this.configuration=await e.resolve("json"),this.configuration))}resolveTree(){if(!this.tree){this.tree=this.querySelector("#typo3-categorytree-tree");let e=this.querySelector("#typo3-categorytree-toolbar");this.tree&&e&&(e.tree=this.tree)}return this.tree}};y=f([E("typo3-backend-navigation-component-category-tree")],y);var h=class extends S{firstUpdated(){this.resolveTree(),super.firstUpdated()}render(){return T`
      <div class="tree-toolbar">
        <div class="tree-toolbar__menu">
          <div class="tree-toolbar__search">
            <label for="toolbarSearch" class="visually-hidden">${g("labels.label.searchString")}</label>
            <input type="search" id="toolbarSearch" class="form-control form-control-sm search-input" placeholder="${g("tree.searchTermInfo")}">
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
              aria-label="${g("labels.openTreeOptionsMenu")}"
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
                    <span class="dropdown-item-column dropdown-item-column-title">${g("labels.refresh")}</span>
                  </span>
                </button>
              </li>
              <li>
                <button class="dropdown-item" type="button" @click="${i=>this.collapseAll(i)}">
                  <span class="dropdown-item-columns">
                    <span class="dropdown-item-column dropdown-item-column-icon" aria-hidden="true">
                      <typo3-backend-icon identifier="apps-pagetree-category-collapse-all" size="small"></typo3-backend-icon>
                    </span>
                    <span class="dropdown-item-column dropdown-item-column-title">${g("labels.collapse")}</span>
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
    `):[]}resolveTree(){if(!this.tree){let e=this.closest("typo3-backend-navigation-component-category-tree")?.querySelector("#typo3-categorytree-tree");e&&(this.tree=e)}return this.tree}handleDragStart(i,e){let t=this.resolveTree();if(!t)return;let o={__hidden:!1,__expanded:!1,__indeterminate:!1,__loading:!1,__processed:!1,__treeDragAction:"",__treeIdentifier:"",__treeParents:[""],__parents:[""],__x:0,__y:0,deletable:!1,depth:0,editable:!0,hasChildren:!1,icon:e.icon,overlayIcon:"",identifier:"NEW"+Math.floor(Math.random()*1e9).toString(16),loaded:!1,name:"",note:"",parentIdentifier:"",prefix:"",recordType:p,suffix:"",tooltip:"",type:"CategoryTreeItem",categoryType:e.nodeType,statusInformation:[],labels:[]};t.draggingNode=o,t.nodeDragMode=d.NEW,i.dataTransfer.clearData();let r={statusIconIdentifier:t.getNodeDragStatusIcon(),tooltipIconIdentifier:e.icon,tooltipLabel:e.title};i.dataTransfer.setData(N.dragTooltip,JSON.stringify(r)),i.dataTransfer.setData(N.newTreenode,JSON.stringify(o)),i.dataTransfer.effectAllowed="move"}};h=f([E("typo3-backend-navigation-component-category-tree-toolbar")],h);export{y as CategoryTreeNavigationComponent,h as CategoryTreeToolbar,u as EditableCategoryTree,Z as navigationComponentName};
