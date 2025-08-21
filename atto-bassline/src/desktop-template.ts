/**
 * Desktop Template - The main desktop environment gadget
 * Manages application windows, taskbar, and global network state
 */

import { primitive, onAny, always, type Template, type PrimitiveTemplate } from './templates-v2'

// Window state for tracking open applications
export interface WindowState {
  id: string
  appGadgetId: string
  title: string
  x: number
  y: number
  width: number
  height: number
  zIndex: number
  minimized: boolean
  maximized: boolean
  focused: boolean
}

// Simple state for tracking windows - will be replaced with proper network state
const windowsArray: WindowState[] = []
let focusedWindowId: string | null = null
let nextZIndex = 1000
let lastProcessedApp: string | null = null

/**
 * Desktop Template - Main desktop environment
 */
export const DesktopTemplate: PrimitiveTemplate = primitive(
  {
    inputs: {
      // Window management
      openApplication: { type: 'object', default: {} }, // { templateName: string, title: string, x?: number, y?: number }
      closeWindow: { type: 'string', default: '' }, // window ID
      focusWindow: { type: 'string', default: '' }, // window ID
      moveWindow: { type: 'object', default: {} }, // { windowId: string, x: number, y: number }
      resizeWindow: { type: 'object', default: {} }, // { windowId: string, width: number, height: number }
      minimizeWindow: { type: 'string', default: '' }, // window ID
      maximizeWindow: { type: 'string', default: '' }, // window ID
      
      // Desktop settings
      setWallpaper: { type: 'string', default: '' },
      toggleTaskbar: { type: 'boolean', default: false },
      
      // Application registry
      availableApps: { type: 'array', default: [] }, // Array of available application templates
    },
    outputs: {
      // Window state
      windows: { type: 'array' }, // Array of WindowState objects
      focusedWindow: { type: 'object' }, // Current focused WindowState
      windowGadgets: { type: 'object' }, // Map of windowId -> window gadgets
      
      // Desktop state
      desktopSettings: { type: 'object' }, // { wallpaper, taskbarVisible }
      
      // Events
      windowOpened: { type: 'object' }, // Last opened window info
      windowClosed: { type: 'string' }, // Last closed window ID
      
      // Application management
      runningApps: { type: 'array' }, // List of running application gadget IDs
    }
  },
  (inputs) => {
    console.log('Desktop compute called with inputs:', inputs)
    console.log('Desktop: openApplication input value:', inputs.openApplication)
    
    let windowOpened = null
    let windowClosed = ''
    
    // Handle opening new application
    if (inputs.openApplication && typeof inputs.openApplication === 'object' && inputs.openApplication.templateName) {
      const appKey = JSON.stringify(inputs.openApplication)
      
      // Skip if this is the same request we just processed
      if (lastProcessedApp === appKey) {
        // Same app request, don't create duplicate window
      } else {
        console.log('Desktop: Processing openApplication:', inputs.openApplication)
        const app = inputs.openApplication
        const windowId = `window-${Date.now()}-${Math.random().toString(36).slice(2)}`
        const appGadgetId = `app-${app.templateName}-${Date.now()}`
        lastProcessedApp = appKey
        
        // Create a simple window
        const newWindow: WindowState = {
        id: windowId,
        appGadgetId: appGadgetId,
        title: app.title || app.templateName,
        x: app.x || 100 + (windowsArray.length * 30), // Cascade windows
        y: app.y || 100 + (windowsArray.length * 30),
        width: app.width || 600,
        height: app.height || 400,
        zIndex: nextZIndex++,
        minimized: false,
        maximized: false,
        focused: true
      }
      
      // Unfocus all other windows
      windowsArray.forEach(window => {
        window.focused = false
      })
      
        // Add to windows array
        windowsArray.push(newWindow)
        focusedWindowId = windowId
        windowOpened = newWindow as any
        
        console.log('Desktop: Created window', windowId, 'for app', appGadgetId, 'Total windows:', windowsArray.length)
      }
    }
    
    // Handle closing window
    if (inputs.closeWindow) {
      const windowIndex = windowsArray.findIndex(w => w.id === inputs.closeWindow)
      if (windowIndex >= 0) {
        const windowId = inputs.closeWindow
        windowsArray.splice(windowIndex, 1)
        windowClosed = windowId
        
        // If this was the focused window, focus the top-most remaining window
        if (focusedWindowId === windowId) {
          if (windowsArray.length > 0) {
            const topWindow = windowsArray.reduce((prev, current) => 
              (current.zIndex > prev.zIndex) ? current : prev
            )
            topWindow.focused = true
            focusedWindowId = topWindow.id
          } else {
            focusedWindowId = null
          }
        }
        
        console.log('Desktop: Closed window', windowId, 'Remaining:', windowsArray.length)
      }
    }
    
    // Handle focusing window
    if (inputs.focusWindow) {
      const window = windowsArray.find(w => w.id === inputs.focusWindow)
      if (window) {
        // Unfocus all windows
        windowsArray.forEach(w => { w.focused = false })
        
        // Focus the requested window and bring to front
        window.focused = true
        window.zIndex = nextZIndex++
        focusedWindowId = inputs.focusWindow
        
        console.log('Desktop: Focused window', inputs.focusWindow)
      }
    }
    
    // Handle moving window
    if (inputs.moveWindow && typeof inputs.moveWindow === 'object' && inputs.moveWindow.windowId) {
      const window = windowsArray.find(w => w.id === inputs.moveWindow.windowId)
      if (window) {
        window.x = inputs.moveWindow.x
        window.y = inputs.moveWindow.y
      }
    }
    
    // Handle resizing window
    if (inputs.resizeWindow && typeof inputs.resizeWindow === 'object' && inputs.resizeWindow.windowId) {
      const window = windowsArray.find(w => w.id === inputs.resizeWindow.windowId)
      if (window) {
        window.width = inputs.resizeWindow.width
        window.height = inputs.resizeWindow.height
      }
    }
    
    // Handle minimizing window
    if (inputs.minimizeWindow) {
      const window = windowsArray.find(w => w.id === inputs.minimizeWindow)
      if (window) {
        window.minimized = !window.minimized
        if (window.minimized && window.focused) {
          window.focused = false
          // Focus another window
          const otherWindows = windowsArray.filter(w => w.id !== window.id && !w.minimized)
          if (otherWindows.length > 0) {
            const topWindow = otherWindows.reduce((prev, current) => 
              (current.zIndex > prev.zIndex) ? current : prev
            )
            topWindow.focused = true
            focusedWindowId = topWindow.id
          } else {
            focusedWindowId = null
          }
        }
      }
    }
    
    // Handle maximizing window
    if (inputs.maximizeWindow) {
      const window = windowsArray.find(w => w.id === inputs.maximizeWindow)
      if (window) {
        window.maximized = !window.maximized
      }
    }
    
    // Handle desktop settings (simplified)
    const wallpaper = inputs.setWallpaper || '#2c3e50'
    const taskbarVisible = true // For now, always visible
    
    // Get focused window
    const focusedWindow = focusedWindowId ? windowsArray.find(w => w.id === focusedWindowId) || null : null
    
    // Get running apps
    const runningApps = windowsArray.map(w => w.appGadgetId)
    
    console.log('Desktop: Returning', windowsArray.length, 'windows')
    
    return {
      windows: [...windowsArray], // Return copy of array
      focusedWindow,
      windowGadgets: {}, // Empty for now since we removed complex spawning
      desktopSettings: {
        wallpaper,
        taskbarVisible
      },
      windowOpened,
      windowClosed,
      runningApps
    }
  },
  'Desktop environment for managing application windows',
  {
    // Activate whenever any window management input changes
    activate: always() // Desktop should always be responsive
  }
)

/**
 * Helper function to create application templates registry
 */
export function createApplicationRegistry(): Map<string, Template> {
  const registry = new Map<string, Template>()
  
  // We'll populate this with actual application templates
  // For now, just placeholders
  
  return registry
}