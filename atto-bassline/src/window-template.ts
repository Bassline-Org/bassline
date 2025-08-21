/**
 * Window Template - Manages window chrome and spawns application gadgets
 * Each window is a gadget that contains an application gadget
 */

import { primitive, type PrimitiveTemplate, type Template } from './templates-v2'
import { createSpawner, provideSpawnerGain } from './spawner'
import { createGadget, signal } from './types'

// Window-specific state for a single window
export interface WindowState {
  id: string
  appGadgetId: string
  appTemplateName: string
  title: string
  x: number
  y: number
  width: number
  height: number
  zIndex: number
  minimized: boolean
  maximized: boolean
  focused: boolean
  spawnerGadget?: any // Reference to spawner gadget that created the app
}

// Global window states (since compute functions are pure)
const windowStates = new Map<string, WindowState>()

function getOrCreateWindowState(gadgetId: string): WindowState {
  if (!windowStates.has(gadgetId)) {
    // Default window state - will be properly initialized when application is set
    windowStates.set(gadgetId, {
      id: gadgetId,
      appGadgetId: '',
      appTemplateName: '',
      title: 'Loading...',
      x: 100,
      y: 100,
      width: 600,
      height: 400,
      zIndex: 1000,
      minimized: false,
      maximized: false,
      focused: false
    })
  }
  return windowStates.get(gadgetId)!
}

/**
 * Window Template - Manages a single window with an application
 */
export const WindowTemplate: PrimitiveTemplate = primitive(
  {
    inputs: {
      // Application to spawn
      applicationTemplate: { type: 'object', default: null }, // Template object for the application
      applicationName: { type: 'string', default: '' }, // Name of the application template
      
      // Window management
      setPosition: { type: 'object', default: null }, // { x: number, y: number }
      setSize: { type: 'object', default: null }, // { width: number, height: number }
      setFocus: { type: 'boolean', default: false },
      setMinimized: { type: 'boolean', default: false },
      setMaximized: { type: 'boolean', default: false },
      setZIndex: { type: 'number', default: 1000 },
      setTitle: { type: 'string', default: '' },
      
      // Close signal
      closeWindow: { type: 'boolean', default: false },
    },
    outputs: {
      // Window state
      windowState: { type: 'object' },
      
      // Application interface
      applicationReady: { type: 'boolean' },
      applicationData: { type: 'object' }, // Data from the spawned application
      
      // Events
      windowClosed: { type: 'boolean' },
      windowFocused: { type: 'boolean' },
    }
  },
  (inputs) => {
    const state = getOrCreateWindowState('current-window') // Would be dynamic in real usage
    
    console.log('Window compute called with inputs:', inputs)
    
    let applicationReady = false
    let applicationData = null
    let windowClosed = false
    let windowFocused = false
    
    // Handle application spawning
    if (inputs.applicationTemplate && inputs.applicationName && !state.appGadgetId) {
      console.log('Window: Spawning application:', inputs.applicationName)
      
      // Create a spawner for this application
      const spawner = createSpawner(`spawner-${Date.now()}`)
      provideSpawnerGain(spawner, 1000) // Give it enough gain to spawn
      
      // Set up spawner inputs (would need to wire these properly in real implementation)
      spawner.contacts.get('template')!.signal = signal(inputs.applicationTemplate, 1.0)
      spawner.contacts.get('trigger')!.signal = signal(true, 1.0)
      spawner.contacts.get('initialStrength')!.signal = signal(500, 1.0)
      spawner.contacts.get('initialGain')!.signal = signal(500, 1.0)
      
      // Trigger spawning (would be done through propagation in real implementation)
      const spawnerInputs = new Map([
        ['template', signal(inputs.applicationTemplate, 1.0)],
        ['trigger', signal(true, 1.0)],
        ['initialStrength', signal(500, 1.0)],
        ['initialGain', signal(500, 1.0)]
      ])
      
      if (spawner.compute) {
        const outputs = spawner.compute(spawnerInputs)
        const instance = outputs.get('instance')
        
        if (instance && instance.value) {
          state.appGadgetId = (instance.value as any).value.id
          state.appTemplateName = inputs.applicationName
          state.spawnerGadget = spawner
          state.title = inputs.applicationName.charAt(0).toUpperCase() + inputs.applicationName.slice(1)
          applicationReady = true
          
          console.log('Window: Successfully spawned application gadget:', state.appGadgetId)
        }
      }
    }
    
    // Handle window management
    if (inputs.setPosition) {
      state.x = inputs.setPosition.x
      state.y = inputs.setPosition.y
    }
    
    if (inputs.setSize) {
      state.width = inputs.setSize.width
      state.height = inputs.setSize.height
    }
    
    if (inputs.setFocus !== state.focused) {
      state.focused = inputs.setFocus
      windowFocused = inputs.setFocus
    }
    
    if (inputs.setMinimized !== state.minimized) {
      state.minimized = inputs.setMinimized
    }
    
    if (inputs.setMaximized !== state.maximized) {
      state.maximized = inputs.setMaximized
    }
    
    if (inputs.setZIndex) {
      state.zIndex = inputs.setZIndex
    }
    
    if (inputs.setTitle) {
      state.title = inputs.setTitle
    }
    
    // Handle close
    if (inputs.closeWindow) {
      windowClosed = true
      // Clean up spawned application
      if (state.spawnerGadget) {
        // Would need proper cleanup here
        console.log('Window: Closing and cleaning up application:', state.appGadgetId)
      }
    }
    
    // Get application data (would come from the spawned gadget in real implementation)
    if (state.spawnerGadget && applicationReady) {
      applicationData = {
        appId: state.appGadgetId,
        templateName: state.appTemplateName,
        // Would include actual application outputs here
      }
    }
    
    return {
      windowState: { ...state }, // Return copy of state
      applicationReady,
      applicationData,
      windowClosed,
      windowFocused
    }
  },
  'Window that manages chrome and spawns application gadgets'
)

/**
 * Helper to create a template signal from a template object
 */
export function createTemplateSignal(template: Template, name: string) {
  return {
    tag: 'template',
    value: {
      id: `template-${name}`,
      template,
      name,
      created: Date.now()
    }
  }
}