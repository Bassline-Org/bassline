import { StrictMode, useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router'
import { router } from './App'
import { ThemeProvider } from './providers/ThemeProvider'
import { ToastProvider } from './components/ToastProvider'
import { BorthProvider } from './components/BorthProvider'
import { bl } from './lib/bl'
import './index.css'

// Register semantic types
import './semantics'

declare global {
  interface Window {
    db: {
      query: (sql: string, params?: unknown[]) => Promise<{ data?: unknown[]; error?: string }>
    }
    app: {
      notify: (title: string, body: string) => Promise<void>
      addRecentDocument: (filePath: string) => Promise<void>
      clearRecentDocuments: () => Promise<void>
      refreshMenu: () => Promise<void>
      onMenuCreateProject: (callback: () => void) => () => void
      onMenuOpenProject: (callback: () => void) => () => void
      onMenuOpenProjectById: (callback: (projectId: string) => void) => () => void
      onMenuExportProject: (callback: () => void) => () => void
      onMenuShowSettings: (callback: () => void) => () => void
      onMenuOpenFile: (callback: (filePath: string) => void) => () => void
    }
    blemacs: {
      readInit: () => Promise<string | null>
      writeInit: (content: string) => Promise<{ success: boolean; error?: string }>
      getInitPath: () => Promise<string>
    }
  }
}

// Set up menu event handlers
function setupMenuHandlers() {
  const cleanups: (() => void)[] = []

  // Create Project - navigate home and create a new project
  cleanups.push(
    window.app.onMenuCreateProject(async () => {
      const project = await bl.projects.create('Untitled Project')
      router.navigate(`/project/${project.id}`)
    })
  )

  // Open Project - navigate to project list
  cleanups.push(
    window.app.onMenuOpenProject(() => {
      router.navigate('/')
    })
  )

  // Open specific project by ID (from recent projects menu)
  cleanups.push(
    window.app.onMenuOpenProjectById((projectId) => {
      router.navigate(`/project/${projectId}`)
    })
  )

  // Export Project - placeholder for now
  cleanups.push(
    window.app.onMenuExportProject(() => {
      // TODO: Implement export functionality
      console.log('Export requested')
    })
  )

  // Show Settings
  cleanups.push(
    window.app.onMenuShowSettings(() => {
      router.navigate('/settings')
    })
  )

  // Open file from recent documents
  cleanups.push(
    window.app.onMenuOpenFile((filePath) => {
      console.log('Open file:', filePath)
      // TODO: Handle opening project files
    })
  )

  return () => cleanups.forEach((cleanup) => cleanup())
}

// Initialize menu handlers
if (window.app) {
  setupMenuHandlers()
}

// App wrapper that loads init file before rendering
function App() {
  const [initSource, setInitSource] = useState<string | undefined>(undefined)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Load init file on startup
    console.log('[App] Loading init file, blemacs available:', !!window.blemacs)
    if (window.blemacs) {
      window.blemacs.readInit()
        .then(content => {
          console.log('[App] Init file loaded:', content ? `${content.length} chars` : 'not found')
          if (content) {
            setInitSource(content)
          }
        })
        .catch(err => {
          console.error('[App] Failed to load init file:', err)
        })
        .finally(() => {
          setLoading(false)
        })
    } else {
      console.log('[App] window.blemacs not available (not in Electron?)')
      setLoading(false)
    }
  }, [])

  // Show nothing while loading (very brief)
  if (loading) {
    return null
  }

  return (
    <ThemeProvider>
      <ToastProvider>
        <BorthProvider initSource={initSource}>
          <RouterProvider router={router} />
        </BorthProvider>
      </ToastProvider>
    </ThemeProvider>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
