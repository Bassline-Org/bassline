import React, { createContext, useContext, useState, useCallback } from 'react'
import type { ReactNode } from 'react'
import type { PropertyPanelFrame } from '~/propagation-react/types/property-panel'
import { useUIStack } from './UIStackContext'

interface PropertyPanelStackContextValue {
  frames: PropertyPanelFrame[]
  currentFrame: PropertyPanelFrame | null
  pushFrame: (frame: Omit<PropertyPanelFrame, 'id' | 'depth' | 'timestamp'>) => void
  popFrame: () => void
  popToFrame: (frameId: string) => void
  clearFrames: () => void
  replaceTopFrame: (frame: Omit<PropertyPanelFrame, 'id' | 'depth' | 'timestamp'>) => void
}

const PropertyPanelStackContext = createContext<PropertyPanelStackContextValue | undefined>(undefined)

interface PropertyPanelStackProviderProps {
  children: ReactNode
}

export function PropertyPanelStackProvider({ children }: PropertyPanelStackProviderProps) {
  const [frames, setFrames] = useState<PropertyPanelFrame[]>([])
  const uiStack = useUIStack()

  // Push a new frame onto the stack
  const pushFrame = useCallback((frame: Omit<PropertyPanelFrame, 'id' | 'depth' | 'timestamp'>) => {
    const newFrame: PropertyPanelFrame = {
      ...frame,
      id: `frame-${Date.now()}`,
      depth: frames.length,
      timestamp: Date.now()
    }

    setFrames(prev => [...prev, newFrame])

    // Also push to UI stack if this is a focused frame
    if (frame.type !== 'selection' && frame.targetId) {
      uiStack.push({
        type: 'propertyFocus',
        data: { nodeId: frame.targetId, frameId: newFrame.id },
        onEscape: () => {
          // Pop the property frame when escape is pressed
          popFrame()
          // Don't prevent default pop - let both stacks pop together
          return false
        }
      })
    }
  }, [frames.length, uiStack])

  // Pop the top frame
  const popFrame = useCallback(() => {
    setFrames(prev => {
      if (prev.length <= 1) return prev // Keep at least one frame
      
      // Check if we're popping a property focus frame
      const topFrame = prev[prev.length - 1]
      if (topFrame && topFrame.type !== 'selection') {
        // Find and pop the corresponding UI stack layer
        const propertyFocusLayer = uiStack.stack.find(
          layer => layer.type === 'propertyFocus' && 
          layer.data?.frameId === topFrame.id
        )
        if (propertyFocusLayer) {
          uiStack.popTo(propertyFocusLayer.id)
        }
      }
      
      return prev.slice(0, -1)
    })
  }, [uiStack])

  // Pop to a specific frame
  const popToFrame = useCallback((frameId: string) => {
    setFrames(prev => {
      const index = prev.findIndex(f => f.id === frameId)
      if (index === -1 || index === prev.length - 1) return prev
      return prev.slice(0, index + 1)
    })
  }, [])

  // Clear all frames except base
  const clearFrames = useCallback(() => {
    setFrames([])
  }, [])

  // Replace the top frame (useful for switching between items at same level)
  const replaceTopFrame = useCallback((frame: Omit<PropertyPanelFrame, 'id' | 'depth' | 'timestamp'>) => {
    setFrames(prev => {
      if (prev.length === 0) {
        // No frames, just push
        return [{
          ...frame,
          id: `frame-${Date.now()}`,
          depth: 0,
          timestamp: Date.now()
        }]
      }

      const newFrames = [...prev]
      const depth = newFrames.length - 1
      newFrames[depth] = {
        ...frame,
        id: `frame-${Date.now()}`,
        depth,
        timestamp: Date.now()
      }
      return newFrames
    })
  }, [])

  const value: PropertyPanelStackContextValue = {
    frames,
    currentFrame: frames[frames.length - 1] || null,
    pushFrame,
    popFrame,
    popToFrame,
    clearFrames,
    replaceTopFrame
  }

  return (
    <PropertyPanelStackContext.Provider value={value}>
      {children}
    </PropertyPanelStackContext.Provider>
  )
}

export function usePropertyPanelStack() {
  const context = useContext(PropertyPanelStackContext)
  if (!context) {
    throw new Error('usePropertyPanelStack must be used within PropertyPanelStackProvider')
  }
  return context
}