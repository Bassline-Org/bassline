import { app, BrowserWindow, ipcMain, nativeImage, Menu, Notification } from 'electron'
import path from 'path'
import { fileURLToPath } from 'url'
import windowStateKeeper from 'electron-window-state'
import { db } from './db'
import { listSystemFonts, searchFonts } from './fonts'
import { createApplicationMenu, createDockMenu, Project } from './menu'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const isMac = process.platform === 'darwin'

// Get the icon path - different for dev vs packaged
function getIconPath() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'data/icons/icon.png')
  }
  return path.join(__dirname, '../data/icons/icon.png')
}

let mainWindow: BrowserWindow | null = null
let mainWindowState: ReturnType<typeof windowStateKeeper> | null = null

function createWindow() {
  const iconPath = getIconPath()

  // Restore window state or use defaults
  mainWindowState = windowStateKeeper({
    defaultWidth: 1280,
    defaultHeight: 800,
  })

  mainWindow = new BrowserWindow({
    x: mainWindowState.x,
    y: mainWindowState.y,
    width: mainWindowState.width,
    height: mainWindowState.height,
    icon: iconPath,
    title: 'Bassline',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false, // Required for better-sqlite3
    },
  })

  // Track window state changes
  mainWindowState.manage(mainWindow)

  // In development, load from Vite dev server
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
    mainWindow.webContents.openDevTools()
  } else {
    // In production, load from built files
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

// Menu callback handlers
const menuCallbacks = {
  createProject: () => {
    mainWindow?.webContents.send('menu:create-project')
  },
  openProject: () => {
    mainWindow?.webContents.send('menu:open-project')
  },
  openProjectById: (id: string) => {
    mainWindow?.webContents.send('menu:open-project-by-id', id)
  },
  exportProject: () => {
    mainWindow?.webContents.send('menu:export-project')
  },
  showSettings: () => {
    mainWindow?.webContents.send('menu:show-settings')
  },
}

// Refresh the application menu with current projects
function refreshMenu() {
  const projects = db.projects.list() as Project[]
  // Sort by updated_at descending (most recent first)
  const sortedProjects = projects.sort((a, b) =>
    new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  )

  // Update application menu
  const appMenu = createApplicationMenu(menuCallbacks, sortedProjects)
  Menu.setApplicationMenu(appMenu)

  // Update dock menu on macOS
  if (isMac && app.dock) {
    app.dock.setMenu(createDockMenu(menuCallbacks, sortedProjects))
  }
}

// Show native notification
export function showNotification(title: string, body: string) {
  if (Notification.isSupported()) {
    new Notification({ title, body }).show()
  }
}

app.whenReady().then(() => {
  // Set app name
  app.setName('Bassline')

  // Set dock icon on macOS
  if (isMac && app.dock) {
    const iconPath = getIconPath()
    const icon = nativeImage.createFromPath(iconPath)
    if (!icon.isEmpty()) {
      app.dock.setIcon(icon)
    }
  }

  // Initialize database
  db.init()

  // Set up menus with recent projects
  refreshMenu()

  // Set up IPC handlers
  setupIpcHandlers()

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

// Handle opening files (for recent documents)
app.on('open-file', (event, filePath) => {
  event.preventDefault()
  // Add to recent documents
  app.addRecentDocument(filePath)
  // Send to renderer
  if (mainWindow) {
    mainWindow.webContents.send('menu:open-file', filePath)
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

function setupIpcHandlers() {
  // Projects (refresh menu after create/delete)
  ipcMain.handle('db:projects:list', () => db.projects.list())
  ipcMain.handle('db:projects:get', (_, id: string) => db.projects.get(id))
  ipcMain.handle('db:projects:create', (_, name: string) => {
    const result = db.projects.create(name)
    refreshMenu() // Update recent projects menu
    return result
  })
  ipcMain.handle('db:projects:delete', (_, id: string) => {
    const result = db.projects.delete(id)
    refreshMenu() // Update recent projects menu
    return result
  })

  // Entities
  ipcMain.handle('db:entities:list', (_, projectId: string) => db.entities.list(projectId))
  ipcMain.handle('db:entities:get', (_, id: string) => db.entities.get(id))
  ipcMain.handle('db:entities:create', (_, projectId: string) => db.entities.create(projectId))
  ipcMain.handle('db:entities:delete', (_, id: string) => db.entities.delete(id))

  // Attrs
  ipcMain.handle('db:attrs:get', (_, entityId: string) => db.attrs.get(entityId))
  ipcMain.handle('db:attrs:set', (_, entityId: string, key: string, value: string, type?: string) =>
    db.attrs.set(entityId, key, value, type)
  )
  ipcMain.handle('db:attrs:delete', (_, entityId: string, key: string) => db.attrs.delete(entityId, key))
  ipcMain.handle('db:attrs:setBatch', (_, entityId: string, attrs: Record<string, string>) =>
    db.attrs.setBatch(entityId, attrs)
  )

  // Stamps
  ipcMain.handle('db:stamps:list', (_, filter?: { kind?: 'template' | 'vocabulary'; category?: string }) =>
    db.stamps.list(filter)
  )
  ipcMain.handle('db:stamps:get', (_, id: string) => db.stamps.get(id))
  ipcMain.handle('db:stamps:create', (_, data: { name: string; sourceEntityId?: string; kind?: 'template' | 'vocabulary'; category?: string; description?: string }) =>
    db.stamps.create(data)
  )
  ipcMain.handle('db:stamps:apply', (_, stampId: string, targetEntityId: string) =>
    db.stamps.apply(stampId, targetEntityId)
  )
  ipcMain.handle('db:stamps:delete', (_, stampId: string) => db.stamps.delete(stampId))
  ipcMain.handle('db:stamps:update', (_, id: string, data: Partial<{ name: string; description: string; icon: string; category: string }>) =>
    db.stamps.update(id, data)
  )

  // Relationships
  ipcMain.handle('db:relationships:list', (_, projectId: string) => db.relationships.list(projectId))
  ipcMain.handle('db:relationships:create', (_, projectId: string, data: any) => db.relationships.create(projectId, data))
  ipcMain.handle('db:relationships:delete', (_, id: string) => db.relationships.delete(id))

  // UI State
  ipcMain.handle('db:uiState:get', (_, projectId: string) => db.uiState.get(projectId))
  ipcMain.handle('db:uiState:update', (_, projectId: string, data: any) => db.uiState.update(projectId, data))

  // Themes
  ipcMain.handle('db:themes:list', () => db.themes.list())
  ipcMain.handle('db:themes:get', (_, id: string) => db.themes.get(id))
  ipcMain.handle('db:themes:create', (_, name: string, basedOn?: string) => db.themes.create(name, basedOn))
  ipcMain.handle('db:themes:updateColor', (_, themeId: string, tokenId: string, value: string) =>
    db.themes.updateColor(themeId, tokenId, value)
  )
  ipcMain.handle('db:themes:delete', (_, id: string) => db.themes.delete(id))
  ipcMain.handle('db:themes:getTokens', () => db.themes.getTokens())

  // Settings
  ipcMain.handle('db:settings:get', (_, key: string) => db.settings.get(key))
  ipcMain.handle('db:settings:set', (_, key: string, value: string) => db.settings.set(key, value))

  // Fonts
  ipcMain.handle('fonts:list', async () => listSystemFonts())
  ipcMain.handle('fonts:search', async (_, query: string) => {
    const fonts = await listSystemFonts()
    return searchFonts(fonts, query)
  })

  // Notifications
  ipcMain.handle('app:notify', (_, title: string, body: string) => {
    showNotification(title, body)
  })

  // Recent documents
  ipcMain.handle('app:addRecentDocument', (_, filePath: string) => {
    app.addRecentDocument(filePath)
  })
  ipcMain.handle('app:clearRecentDocuments', () => {
    app.clearRecentDocuments()
  })

  // Menu refresh
  ipcMain.handle('app:refreshMenu', () => {
    refreshMenu()
  })
}
