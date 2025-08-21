/**
 * Window Component - React UI for individual windows with application content
 * Connects to Window gadgets and renders window chrome + application content
 */

import React, { useCallback, useRef, useState } from 'react'
import { useTemplate, useContact } from './react-templates'
import { WindowTemplate, type WindowState } from './window-template'
import type { Gadget } from './types'

// Props for the Window component
interface WindowProps {
  window: WindowState
  windowGadget?: Gadget // The spawned window gadget
  applicationRegistry?: Map<string, any> // Available application templates
  onFocus: (windowId: string) => void
  onClose: (windowId: string) => void
  onMove: (windowId: string, x: number, y: number) => void
  onResize: (windowId: string, width: number, height: number) => void
  onMinimize: (windowId: string) => void
  onMaximize: (windowId: string) => void
  renderApplication?: (templateName: string, appId: string) => React.ReactNode
}

export function Window({ 
  window, 
  windowGadget,
  applicationRegistry,
  onFocus, 
  onClose, 
  onMove, 
  onResize, 
  onMinimize, 
  onMaximize,
  renderApplication
}: WindowProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const dragStart = useRef({ x: 0, y: 0, windowX: 0, windowY: 0 })
  const resizeStart = useRef({ x: 0, y: 0, width: 0, height: 0 })

  // Connect to the window gadget if available
  const windowGadgetHook = windowGadget ? useTemplate(WindowTemplate, {}, window.id) : null
  
  // Window gadget contacts (if connected)
  const [, setApplicationTemplate] = windowGadget ? useContact<any>(windowGadget, 'applicationTemplate') : [null, () => {}]
  const [, setApplicationName] = windowGadget ? useContact<string>(windowGadget, 'applicationName') : [null, () => {}]
  const [, setPosition] = windowGadget ? useContact<any>(windowGadget, 'setPosition') : [null, () => {}]
  const [, setSize] = windowGadget ? useContact<any>(windowGadget, 'setSize') : [null, () => {}]
  const [, setFocus] = windowGadget ? useContact<boolean>(windowGadget, 'setFocus') : [null, () => {}]
  const [, setMinimized] = windowGadget ? useContact<boolean>(windowGadget, 'setMinimized') : [null, () => {}]
  const [, setMaximized] = windowGadget ? useContact<boolean>(windowGadget, 'setMaximized') : [null, () => {}]
  const [, closeWindow] = windowGadget ? useContact<boolean>(windowGadget, 'closeWindow') : [null, () => {}]
  
  // Window gadget outputs
  const [windowState] = windowGadget ? useContact<any>(windowGadget, 'windowState') : [null]
  const [applicationReady] = windowGadget ? useContact<boolean>(windowGadget, 'applicationReady') : [false]
  const [applicationData] = windowGadget ? useContact<any>(windowGadget, 'applicationData') : [null]

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    onFocus(window.id)
    
    if (e.currentTarget.classList.contains('window-resize-handle')) {
      setIsResizing(true)
      resizeStart.current = {
        x: e.clientX,
        y: e.clientY,
        width: window.width,
        height: window.height
      }
    } else {
      setIsDragging(true)
      dragStart.current = {
        x: e.clientX,
        y: e.clientY,
        windowX: window.x,
        windowY: window.y
      }
    }
  }, [window, onFocus])

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isDragging) {
      const deltaX = e.clientX - dragStart.current.x
      const deltaY = e.clientY - dragStart.current.y
      const newX = dragStart.current.windowX + deltaX
      const newY = dragStart.current.windowY + deltaY
      
      onMove(window.id, newX, newY)
      
      // Also update the window gadget if connected
      if (setPosition) {
        setPosition({ x: newX, y: newY })
      }
    } else if (isResizing) {
      const deltaX = e.clientX - resizeStart.current.x
      const deltaY = e.clientY - resizeStart.current.y
      const newWidth = Math.max(200, resizeStart.current.width + deltaX)
      const newHeight = Math.max(150, resizeStart.current.height + deltaY)
      
      onResize(window.id, newWidth, newHeight)
      
      // Also update the window gadget if connected
      if (setSize) {
        setSize({ width: newWidth, height: newHeight })
      }
    }
  }, [isDragging, isResizing, window.id, onMove, onResize, setPosition, setSize])

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
    setIsResizing(false)
  }, [])

  React.useEffect(() => {
    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [isDragging, isResizing, handleMouseMove, handleMouseUp])

  // Initialize application in window gadget if available
  React.useEffect(() => {
    if (windowGadget && applicationRegistry && !applicationReady) {
      const templateName = extractTemplateNameFromAppId(window.appGadgetId)
      const template = applicationRegistry.get(templateName)
      
      if (template && setApplicationTemplate && setApplicationName) {
        console.log('Window: Setting up application', templateName, 'in window gadget')
        setApplicationTemplate(template)
        setApplicationName(templateName)
      }
    }
  }, [windowGadget, applicationRegistry, applicationReady, window.appGadgetId, setApplicationTemplate, setApplicationName])

  console.log('Window component rendering:', window.id, 'minimized:', window.minimized, 'position:', window.x, window.y, 'size:', window.width, 'x', window.height, 'zIndex:', window.zIndex)

  if (window.minimized) {
    return null // Minimized windows are hidden
  }

  return (
    <div
      className="absolute bg-white border-2 border-gray-400 shadow-2xl rounded-lg overflow-hidden"
      style={{
        left: window.maximized ? '50%' : `${window.x}px`,
        top: window.maximized ? 0 : `${window.y}px`,
        width: window.maximized ? '100vw' : `${window.width}px`,
        height: window.maximized ? 'calc(100vh - 60px)' : `${window.height}px`,
        zIndex: window.zIndex || 1000,
        transform: window.maximized ? 'translate(-50%, 0)' : 'none',
      }}
      onMouseDown={() => onFocus(window.id)}
    >
      {/* Window Title Bar */}
      <div
        className={`h-8 bg-gray-100 border-b border-gray-300 flex items-center justify-between px-3 cursor-move select-none ${
          window.focused ? 'bg-blue-100' : 'bg-gray-100'
        }`}
        onMouseDown={handleMouseDown}
      >
        <span className="text-sm font-medium text-gray-700 truncate">
          {window.title}
          {applicationReady && (
            <span className="ml-2 text-xs text-green-600">●</span>
          )}
        </span>
        
        <div className="flex items-center gap-1">
          <button
            className="w-4 h-4 bg-yellow-400 rounded-full hover:bg-yellow-500"
            onClick={(e) => {
              e.stopPropagation()
              onMinimize(window.id)
              if (setMinimized) {
                setMinimized(!window.minimized)
              }
            }}
            title="Minimize"
          />
          <button
            className="w-4 h-4 bg-green-400 rounded-full hover:bg-green-500"
            onClick={(e) => {
              e.stopPropagation()
              onMaximize(window.id)
              if (setMaximized) {
                setMaximized(!window.maximized)
              }
            }}
            title="Maximize"
          />
          <button
            className="w-4 h-4 bg-red-400 rounded-full hover:bg-red-500"
            onClick={(e) => {
              e.stopPropagation()
              onClose(window.id)
              if (closeWindow) {
                closeWindow(true)
              }
            }}
            title="Close"
          />
        </div>
      </div>

      {/* Window Content */}
      <div className="overflow-auto bg-white" style={{ height: 'calc(100% - 32px)' }}>
        {/* Show application content */}
        {applicationReady && applicationData ? (
          <div className="p-4">
            <h3 className="text-lg font-semibold mb-2">Application Ready</h3>
            <p className="text-gray-600 mb-2">
              Application: {applicationData.templateName}
            </p>
            <p className="text-sm text-gray-500">
              App ID: {applicationData.appId}
            </p>
            <div className="mt-4 p-3 bg-gray-50 rounded">
              <p className="text-sm text-gray-600">
                Gadget-based application is running
              </p>
            </div>
          </div>
        ) : renderApplication ? (
          (() => {
            const templateName = extractTemplateNameFromAppId(window.appGadgetId)
            console.log('Window: Rendering application, appGadgetId:', window.appGadgetId, 'extracted templateName:', templateName)
            return renderApplication(templateName, window.appGadgetId)
          })()
        ) : (
          <div className="p-4 text-gray-500">
            <h3 className="text-lg font-semibold mb-2">{window.title}</h3>
            <p className="text-gray-600 mb-2">
              Application gadget: {window.appGadgetId}
            </p>
            <p className="text-sm text-gray-500 mt-2">
              Window gadget: {windowGadget ? 'Connected' : 'Not connected'}
            </p>
            {windowGadget && (
              <div className="mt-4 p-3 bg-blue-50 rounded">
                <p className="text-sm text-blue-600">
                  Window gadget connected - ready for application spawning
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Resize Handle */}
      {!window.maximized && (
        <div
          className="window-resize-handle absolute bottom-0 right-0 w-4 h-4 cursor-nw-resize"
          onMouseDown={handleMouseDown}
        >
          <div className="w-full h-full bg-gray-300 opacity-50" />
        </div>
      )}
    </div>
  )
}

// Helper to extract template name from app gadget ID
function extractTemplateNameFromAppId(appId: string): string {
  // App IDs are in format: app-{templateName}-{timestamp}
  const match = appId.match(/^app-([^-]+)-/)
  return match ? match[1] : 'unknown'
}