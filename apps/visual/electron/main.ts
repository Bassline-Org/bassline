import { app, BrowserWindow, ipcMain, nativeImage, Menu, Notification } from 'electron'
import path from 'path'
import { fileURLToPath } from 'url'
import windowStateKeeper from 'electron-window-state'
import { db } from './db'
import { listSystemFonts, searchFonts } from './fonts'
import { createApplicationMenu, createDockMenu, Project } from './menu'
import { createVisualResources } from './resources'

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
    title: 'HomeBass',
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
  app.setName('HomeBass')

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
  // ==========================================================================
  // Bassline Resources (unified API)
  // ==========================================================================

  const resources = createVisualResources(db)

  ipcMain.handle('bl:get', async (_, headers: { path: string }) => {
    const result = await resources.get(headers)
    // Refresh menu when projects change
    if (headers.path === '/projects') {
      refreshMenu()
    }
    return result
  })

  ipcMain.handle('bl:put', async (_, headers: { path: string }, body: unknown) => {
    const result = await resources.put(headers, body)
    // Refresh menu when projects are created/deleted
    if (headers.path.startsWith('/projects')) {
      refreshMenu()
    }
    return result
  })

  // ==========================================================================
  // Non-resource handlers (fonts, notifications, etc)
  // ==========================================================================

  // Fonts
  ipcMain.handle('fonts:list', async () => listSystemFonts())
  ipcMain.handle('fonts:search', async (_, query: string) => {
    const fonts = await listSystemFonts()
    return searchFonts(fonts, query)
  })

  // Database queries (for borth)
  ipcMain.handle('db:query', async (_, sql: string, params?: unknown[]) => {
    try {
      return { data: db.query.all(sql, params || []) }
    } catch (error) {
      return { error: (error as Error).message }
    }
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
