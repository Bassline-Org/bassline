import { contextBridge, ipcRenderer } from 'electron'

// Fonts API
contextBridge.exposeInMainWorld('fonts', {
  list: () => ipcRenderer.invoke('fonts:list'),
  search: (query: string) => ipcRenderer.invoke('fonts:search', query),
})

// App API (notifications, recent documents, etc.)
contextBridge.exposeInMainWorld('app', {
  // Notifications
  notify: (title: string, body: string) => ipcRenderer.invoke('app:notify', title, body),

  // Recent documents
  addRecentDocument: (filePath: string) => ipcRenderer.invoke('app:addRecentDocument', filePath),
  clearRecentDocuments: () => ipcRenderer.invoke('app:clearRecentDocuments'),

  // Menu event listeners
  onMenuCreateProject: (callback: () => void) => {
    ipcRenderer.on('menu:create-project', callback)
    return () => ipcRenderer.removeListener('menu:create-project', callback)
  },
  onMenuOpenProject: (callback: () => void) => {
    ipcRenderer.on('menu:open-project', callback)
    return () => ipcRenderer.removeListener('menu:open-project', callback)
  },
  onMenuExportProject: (callback: () => void) => {
    ipcRenderer.on('menu:export-project', callback)
    return () => ipcRenderer.removeListener('menu:export-project', callback)
  },
  onMenuShowSettings: (callback: () => void) => {
    ipcRenderer.on('menu:show-settings', callback)
    return () => ipcRenderer.removeListener('menu:show-settings', callback)
  },
  onMenuOpenFile: (callback: (filePath: string) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, filePath: string) => callback(filePath)
    ipcRenderer.on('menu:open-file', handler)
    return () => ipcRenderer.removeListener('menu:open-file', handler)
  },
  onMenuOpenProjectById: (callback: (projectId: string) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, projectId: string) => callback(projectId)
    ipcRenderer.on('menu:open-project-by-id', handler)
    return () => ipcRenderer.removeListener('menu:open-project-by-id', handler)
  },

  // Menu refresh
  refreshMenu: () => ipcRenderer.invoke('app:refreshMenu'),
})

contextBridge.exposeInMainWorld('db', {
  projects: {
    list: () => ipcRenderer.invoke('db:projects:list'),
    get: (id: string) => ipcRenderer.invoke('db:projects:get', id),
    create: (name: string) => ipcRenderer.invoke('db:projects:create', name),
    delete: (id: string) => ipcRenderer.invoke('db:projects:delete', id),
  },
  entities: {
    list: (projectId: string) => ipcRenderer.invoke('db:entities:list', projectId),
    get: (id: string) => ipcRenderer.invoke('db:entities:get', id),
    create: (projectId: string) => ipcRenderer.invoke('db:entities:create', projectId),
    delete: (id: string) => ipcRenderer.invoke('db:entities:delete', id),
  },
  attrs: {
    get: (entityId: string) => ipcRenderer.invoke('db:attrs:get', entityId),
    set: (entityId: string, key: string, value: string, type?: string) =>
      ipcRenderer.invoke('db:attrs:set', entityId, key, value, type),
    delete: (entityId: string, key: string) => ipcRenderer.invoke('db:attrs:delete', entityId, key),
    setBatch: (entityId: string, attrs: Record<string, string>) =>
      ipcRenderer.invoke('db:attrs:setBatch', entityId, attrs),
  },
  stamps: {
    list: (filter?: { kind?: 'template' | 'vocabulary'; category?: string }) =>
      ipcRenderer.invoke('db:stamps:list', filter),
    get: (id: string) => ipcRenderer.invoke('db:stamps:get', id),
    create: (data: { name: string; sourceEntityId?: string; kind?: 'template' | 'vocabulary'; category?: string; description?: string }) =>
      ipcRenderer.invoke('db:stamps:create', data),
    apply: (stampId: string, targetEntityId: string) =>
      ipcRenderer.invoke('db:stamps:apply', stampId, targetEntityId),
    delete: (stampId: string) => ipcRenderer.invoke('db:stamps:delete', stampId),
    update: (id: string, data: Partial<{ name: string; description: string; icon: string; category: string }>) =>
      ipcRenderer.invoke('db:stamps:update', id, data),
  },
  relationships: {
    list: (projectId: string) => ipcRenderer.invoke('db:relationships:list', projectId),
    create: (projectId: string, data: any) => ipcRenderer.invoke('db:relationships:create', projectId, data),
    delete: (id: string) => ipcRenderer.invoke('db:relationships:delete', id),
  },
  uiState: {
    get: (projectId: string) => ipcRenderer.invoke('db:uiState:get', projectId),
    update: (projectId: string, data: any) => ipcRenderer.invoke('db:uiState:update', projectId, data),
  },
  themes: {
    list: () => ipcRenderer.invoke('db:themes:list'),
    get: (id: string) => ipcRenderer.invoke('db:themes:get', id),
    create: (name: string, basedOn?: string) => ipcRenderer.invoke('db:themes:create', name, basedOn),
    updateColor: (themeId: string, tokenId: string, value: string) =>
      ipcRenderer.invoke('db:themes:updateColor', themeId, tokenId, value),
    delete: (id: string) => ipcRenderer.invoke('db:themes:delete', id),
    getTokens: () => ipcRenderer.invoke('db:themes:getTokens'),
  },
  settings: {
    get: (key: string) => ipcRenderer.invoke('db:settings:get', key),
    set: (key: string, value: string) => ipcRenderer.invoke('db:settings:set', key, value),
  },
})
