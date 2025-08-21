/**
 * Desktop Component - React UI for the Desktop gadget
 * Renders application windows, taskbar, and handles window management
 */

import React, { useCallback, useRef, useState } from 'react'
import { useTemplate, useContact } from './react-templates'
import { DesktopTemplate, type WindowState } from './desktop-template'
import { Window } from './window-component'
import type { Gadget, Template } from './types'


// System Tray component with live clock
function SystemTray() {
  const [currentTime, setCurrentTime] = useState(new Date())

  React.useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  return (
    <div className="flex items-center gap-3">
      {/* Network status indicator */}
      <div className="w-2 h-2 bg-green-400 rounded-full" title="Network Active" />
      
      {/* Clock */}
      <span className="text-gray-100 text-sm font-mono">
        {currentTime.toLocaleTimeString()}
      </span>
    </div>
  )
}

// Taskbar component
interface TaskbarProps {
  windows: WindowState[]
  onFocusWindow: (windowId: string) => void
  onOpenApplication: (app: { templateName: string, title: string }) => void
  availableApps: Array<{ name: string, template: Template, title: string }>
}

function Taskbar({ windows, onFocusWindow, onOpenApplication, availableApps }: TaskbarProps) {
  const [showAppMenu, setShowAppMenu] = useState(false)
  
  console.log('Taskbar rendering with availableApps:', availableApps.length, availableApps)

  return (
    <div className="fixed bottom-0 left-0 right-0 h-12 bg-gray-800 border-t border-gray-700 flex items-center px-4 z-50">
      {/* App Launcher */}
      <div className="relative">
        <button
          className="h-8 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm font-medium"
          onClick={() => {
            console.log('Apps button clicked, showAppMenu:', !showAppMenu)
            setShowAppMenu(!showAppMenu)
          }}
        >
          Apps {showAppMenu ? '🔴' : '🟢'}
        </button>
      </div>
      
      {/* App menu - positioned above taskbar */}
      {showAppMenu && (
        <div className="fixed bottom-14 left-4 bg-white border-2 border-gray-300 rounded shadow-xl min-w-48 z-[60] max-h-64 overflow-y-auto">
          {availableApps.map((app, index) => (
            <button
              key={index}
              className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 border-b border-gray-200 last:border-b-0 text-black"
              onClick={() => {
                console.log('App clicked:', app.name, app.title)
                onOpenApplication({ templateName: app.name, title: app.title })
                setShowAppMenu(false)
              }}
            >
              {app.title}
            </button>
          ))}
        </div>
      )}

      {/* Window Tasks */}
      <div className="flex-1 flex items-center gap-2 ml-4">
        {windows.filter(w => !w.minimized).map((window) => (
          <button
            key={window.id}
            className={`h-8 px-3 rounded text-sm truncate max-w-48 ${
              window.focused 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-600 text-gray-100 hover:bg-gray-500 hover:text-white'
            }`}
            onClick={() => onFocusWindow(window.id)}
            title={window.title}
          >
            {window.title}
          </button>
        ))}
      </div>

      {/* System Tray with live clock */}
      <SystemTray />
    </div>
  )
}

// Application content renderer type
type ApplicationRenderer = (templateName: string, appId: string) => React.ReactNode

// Main Desktop component
interface DesktopProps {
  applicationRegistry?: Map<string, Template>
  renderApplication?: ApplicationRenderer
  children?: React.ReactNode
}

export function Desktop({ applicationRegistry = new Map(), renderApplication, children }: DesktopProps) {
  const desktop = useTemplate(DesktopTemplate, {}, 'main-desktop')
  
  // Desktop contacts
  const [, setOpenApplication] = useContact<any>(desktop.gadget, 'openApplication')
  const [, setCloseWindow] = useContact<string>(desktop.gadget, 'closeWindow')
  const [, setFocusWindow] = useContact<string>(desktop.gadget, 'focusWindow')
  const [, setMoveWindow] = useContact<any>(desktop.gadget, 'moveWindow')
  const [, setResizeWindow] = useContact<any>(desktop.gadget, 'resizeWindow')
  const [, setMinimizeWindow] = useContact<string>(desktop.gadget, 'minimizeWindow')
  const [, setMaximizeWindow] = useContact<string>(desktop.gadget, 'maximizeWindow')
  
  // Desktop outputs
  const [windows] = useContact<WindowState[]>(desktop.gadget, 'windows')
  const [windowGadgets] = useContact<Record<string, any>>(desktop.gadget, 'windowGadgets')
  const [desktopSettings] = useContact<any>(desktop.gadget, 'desktopSettings')
  
  console.log('Desktop Component: windows =', windows?.length || 0, windows)
  console.log('Desktop Component: windowGadgets =', Object.keys(windowGadgets || {}).length, windowGadgets)

  // Convert application registry to array for taskbar
  const availableApps = Array.from(applicationRegistry.entries()).map(([name, template]) => ({
    name,
    template,
    title: name.charAt(0).toUpperCase() + name.slice(1) // Capitalize first letter
  }))
  
  console.log('Available apps:', availableApps)

  const handleOpenApplication = useCallback((app: { templateName: string, title: string }) => {
    console.log('Opening application:', app)
    setOpenApplication(app)
  }, [setOpenApplication])

  const handleCloseWindow = useCallback((windowId: string) => {
    setCloseWindow(windowId)
    requestAnimationFrame(() => setCloseWindow(''))
  }, [setCloseWindow])

  const handleFocusWindow = useCallback((windowId: string) => {
    setFocusWindow(windowId)
    requestAnimationFrame(() => setFocusWindow(''))
  }, [setFocusWindow])

  const handleMoveWindow = useCallback((windowId: string, x: number, y: number) => {
    setMoveWindow({ windowId, x, y })
    requestAnimationFrame(() => setMoveWindow(null))
  }, [setMoveWindow])

  const handleResizeWindow = useCallback((windowId: string, width: number, height: number) => {
    setResizeWindow({ windowId, width, height })
    requestAnimationFrame(() => setResizeWindow(null))
  }, [setResizeWindow])

  const handleMinimizeWindow = useCallback((windowId: string) => {
    setMinimizeWindow(windowId)
    requestAnimationFrame(() => setMinimizeWindow(''))
  }, [setMinimizeWindow])

  const handleMaximizeWindow = useCallback((windowId: string) => {
    setMaximizeWindow(windowId)
    requestAnimationFrame(() => setMaximizeWindow(''))
  }, [setMaximizeWindow])

  return (
    <div 
      className="fixed inset-0 overflow-hidden"
      style={{ 
        background: desktopSettings?.wallpaper || '#2c3e50',
        paddingBottom: '48px' // Space for taskbar
      }}
    >
      {/* Desktop background - can be clicked to unfocus windows */}
      <div 
        className="absolute inset-0 z-0"
        onClick={() => {
          // Unfocus all windows by focusing a non-existent window
          setFocusWindow('')
        }}
      />

      {/* Test window - always visible */}
      <div 
        className="absolute bg-red-500 text-white p-4 rounded z-50"
        style={{ 
          top: '100px',
          left: '100px',
          width: '200px',
          height: '100px'
        }}
      >
        TEST WINDOW - Windows count: {windows?.length || 0}
      </div>

      {/* Render application windows */}
      {(windows || []).map((window) => {
        console.log('Desktop: Rendering window', window.id, window)
        return (
          <Window
            key={window.id}
            window={window}
            windowGadget={windowGadgets?.[window.id]}
            applicationRegistry={applicationRegistry}
            onFocus={handleFocusWindow}
            onClose={handleCloseWindow}
            onMove={handleMoveWindow}
            onResize={handleResizeWindow}
            onMinimize={handleMinimizeWindow}
            onMaximize={handleMaximizeWindow}
            renderApplication={renderApplication}
          />
        )
      })}

      {/* Custom children (for additional desktop elements) */}
      {children}

      {/* Taskbar */}
      <Taskbar
        windows={windows || []}
        onFocusWindow={handleFocusWindow}
        onOpenApplication={handleOpenApplication}
        availableApps={availableApps}
      />
    </div>
  )
}