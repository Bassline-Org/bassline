import { contextBridge as t, ipcRenderer as n } from "electron";
t.exposeInMainWorld("bl", {
  get: (e) => n.invoke("bl:get", e),
  put: (e, o) => n.invoke("bl:put", e, o)
});
t.exposeInMainWorld("db", {
  query: (e, o) => n.invoke("db:query", e, o)
});
t.exposeInMainWorld("fonts", {
  list: () => n.invoke("fonts:list"),
  search: (e) => n.invoke("fonts:search", e)
});
t.exposeInMainWorld("app", {
  // Notifications
  notify: (e, o) => n.invoke("app:notify", e, o),
  // Recent documents
  addRecentDocument: (e) => n.invoke("app:addRecentDocument", e),
  clearRecentDocuments: () => n.invoke("app:clearRecentDocuments"),
  // Menu event listeners
  onMenuCreateProject: (e) => (n.on("menu:create-project", e), () => n.removeListener("menu:create-project", e)),
  onMenuOpenProject: (e) => (n.on("menu:open-project", e), () => n.removeListener("menu:open-project", e)),
  onMenuExportProject: (e) => (n.on("menu:export-project", e), () => n.removeListener("menu:export-project", e)),
  onMenuShowSettings: (e) => (n.on("menu:show-settings", e), () => n.removeListener("menu:show-settings", e)),
  onMenuOpenFile: (e) => {
    const o = (i, r) => e(r);
    return n.on("menu:open-file", o), () => n.removeListener("menu:open-file", o);
  },
  onMenuOpenProjectById: (e) => {
    const o = (i, r) => e(r);
    return n.on("menu:open-project-by-id", o), () => n.removeListener("menu:open-project-by-id", o);
  },
  // Menu refresh
  refreshMenu: () => n.invoke("app:refreshMenu")
});
t.exposeInMainWorld("blemacs", {
  readInit: () => n.invoke("blemacs:readInit"),
  writeInit: (e) => n.invoke("blemacs:writeInit", e),
  getInitPath: () => n.invoke("blemacs:getInitPath")
});
