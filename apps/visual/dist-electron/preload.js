import { contextBridge as i, ipcRenderer as t } from "electron";
i.exposeInMainWorld("fonts", {
  list: () => t.invoke("fonts:list"),
  search: (e) => t.invoke("fonts:search", e)
});
i.exposeInMainWorld("app", {
  // Notifications
  notify: (e, n) => t.invoke("app:notify", e, n),
  // Recent documents
  addRecentDocument: (e) => t.invoke("app:addRecentDocument", e),
  clearRecentDocuments: () => t.invoke("app:clearRecentDocuments"),
  // Menu event listeners
  onMenuCreateProject: (e) => (t.on("menu:create-project", e), () => t.removeListener("menu:create-project", e)),
  onMenuOpenProject: (e) => (t.on("menu:open-project", e), () => t.removeListener("menu:open-project", e)),
  onMenuExportProject: (e) => (t.on("menu:export-project", e), () => t.removeListener("menu:export-project", e)),
  onMenuShowSettings: (e) => (t.on("menu:show-settings", e), () => t.removeListener("menu:show-settings", e)),
  onMenuOpenFile: (e) => {
    const n = (o, s) => e(s);
    return t.on("menu:open-file", n), () => t.removeListener("menu:open-file", n);
  },
  onMenuOpenProjectById: (e) => {
    const n = (o, s) => e(s);
    return t.on("menu:open-project-by-id", n), () => t.removeListener("menu:open-project-by-id", n);
  },
  // Menu refresh
  refreshMenu: () => t.invoke("app:refreshMenu")
});
i.exposeInMainWorld("db", {
  projects: {
    list: () => t.invoke("db:projects:list"),
    get: (e) => t.invoke("db:projects:get", e),
    create: (e) => t.invoke("db:projects:create", e),
    delete: (e) => t.invoke("db:projects:delete", e)
  },
  entities: {
    list: (e) => t.invoke("db:entities:list", e),
    get: (e) => t.invoke("db:entities:get", e),
    create: (e) => t.invoke("db:entities:create", e),
    delete: (e) => t.invoke("db:entities:delete", e)
  },
  attrs: {
    get: (e) => t.invoke("db:attrs:get", e),
    set: (e, n, o, s) => t.invoke("db:attrs:set", e, n, o, s),
    delete: (e, n) => t.invoke("db:attrs:delete", e, n),
    setBatch: (e, n) => t.invoke("db:attrs:setBatch", e, n)
  },
  stamps: {
    list: (e) => t.invoke("db:stamps:list", e),
    get: (e) => t.invoke("db:stamps:get", e),
    create: (e) => t.invoke("db:stamps:create", e),
    apply: (e, n) => t.invoke("db:stamps:apply", e, n),
    delete: (e) => t.invoke("db:stamps:delete", e),
    update: (e, n) => t.invoke("db:stamps:update", e, n)
  },
  relationships: {
    list: (e) => t.invoke("db:relationships:list", e),
    create: (e, n) => t.invoke("db:relationships:create", e, n),
    delete: (e) => t.invoke("db:relationships:delete", e)
  },
  uiState: {
    get: (e) => t.invoke("db:uiState:get", e),
    update: (e, n) => t.invoke("db:uiState:update", e, n)
  },
  themes: {
    list: () => t.invoke("db:themes:list"),
    get: (e) => t.invoke("db:themes:get", e),
    create: (e, n) => t.invoke("db:themes:create", e, n),
    updateColor: (e, n, o) => t.invoke("db:themes:updateColor", e, n, o),
    delete: (e) => t.invoke("db:themes:delete", e),
    getTokens: () => t.invoke("db:themes:getTokens")
  },
  settings: {
    get: (e) => t.invoke("db:settings:get", e),
    set: (e, n) => t.invoke("db:settings:set", e, n)
  }
});
