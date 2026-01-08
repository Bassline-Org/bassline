import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router'
import { router } from './App'
import { ThemeProvider } from './providers/ThemeProvider'
import { bl } from './lib/bl'
import './index.css'

declare global {
  interface Window {
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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <RouterProvider router={router} />
    </ThemeProvider>
  </StrictMode>
)
