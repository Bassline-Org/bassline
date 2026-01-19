import { contextBridge, ipcRenderer } from 'electron'

// =============================================================================
// Bassline Resources API
// =============================================================================

export interface ResourceHeaders {
  path: string
  [key: string]: unknown
}

export interface ResourceResponse<T = unknown> {
  headers: {
    type?: string
    condition?: 'not-found' | 'error' | 'empty'
    created?: boolean
    deleted?: boolean
    updated?: boolean
    [key: string]: unknown
  }
  body: T
}

contextBridge.exposeInMainWorld('bl', {
  get: <T = unknown>(headers: ResourceHeaders): Promise<ResourceResponse<T>> =>
    ipcRenderer.invoke('bl:get', headers),
  put: <T = unknown>(headers: ResourceHeaders, body?: unknown): Promise<ResourceResponse<T>> =>
    ipcRenderer.invoke('bl:put', headers, body),
})

// Database query API (for borth)
contextBridge.exposeInMainWorld('db', {
  query: (sql: string, params?: unknown[]): Promise<{ data?: unknown[]; error?: string }> =>
    ipcRenderer.invoke('db:query', sql, params),
})

// =============================================================================
// Fonts API
// =============================================================================

contextBridge.exposeInMainWorld('fonts', {
  list: () => ipcRenderer.invoke('fonts:list'),
  search: (query: string) => ipcRenderer.invoke('fonts:search', query),
})

// =============================================================================
// App API (notifications, recent documents, menu events)
// =============================================================================

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

// =============================================================================
// Blemacs API (init file, etc.)
// =============================================================================

contextBridge.exposeInMainWorld('blemacs', {
  readInit: (): Promise<string | null> => ipcRenderer.invoke('blemacs:readInit'),
  writeInit: (content: string): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('blemacs:writeInit', content),
  getInitPath: (): Promise<string> => ipcRenderer.invoke('blemacs:getInitPath'),
})
