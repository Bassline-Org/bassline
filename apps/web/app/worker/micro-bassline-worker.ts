/**
 * Micro-Bassline Worker
 * Runs the propagation network in a Web Worker for non-blocking computation
 */

console.log('[Worker] Starting micro-bassline worker initialization')

// Import from micro-bassline package
import { runtime, defaultPrimitives } from 'micro-bassline'

console.log('[Worker] Imports successful, creating runtime')

try {
  // Create the main application network
  const network = runtime(undefined, defaultPrimitives)

  // Create root group with MGP contacts exposed
  // This is the single persistent root of our entire application
  const rootGroupId = network.createGroup('root', undefined, {
    'expose-structure': true,
    'expose-dynamics': true,
    'allow-meta-mutation': true,
    name: 'Root',
    description: 'Main application root - all projects are subgroups of this'
  })

  // Get references to MGP contacts for bridging
  // We use 'root' instead of 'app' to match our single-session architecture
  const structureContact = network.contacts.get('root:structure')
  const dynamicsContact = network.contacts.get('root:dynamics')
  const actionsContact = network.contacts.get('root:actions')

  if (!structureContact || !dynamicsContact || !actionsContact) {
    throw new Error('Failed to initialize MGP contacts')
  }

  // Forward structure changes to main thread
  structureContact.onValueChange(value => {
    self.postMessage({ 
      type: 'structure', 
      value 
    })
  })

  // Forward dynamics events to main thread
  dynamicsContact.onValueChange(event => {
    self.postMessage({ 
      type: 'dynamics', 
      event 
    })
  })

  // Handle incoming messages from main thread
  self.onmessage = (e: MessageEvent) => {
    const { type, action, state } = e.data
    
    switch (type) {
      case 'action':
        // Forward action to the network's actions contact
        actionsContact.setValue(action)
        break
        
      case 'ping':
        // Health check
        self.postMessage({ type: 'pong' })
        break
        
      case 'reset':
        // Clear everything and recreate root
        // Note: This is a simplified reset - in production we might want to 
        // properly clean up all groups/contacts/wires first
        console.log('[Worker] Resetting network')
        
        // Clear all subgroups of root (keep root itself)
        const currentStructure = structureContact.getValue()
        if (currentStructure?.groups) {
          currentStructure.groups.forEach((group: any, id: string) => {
            if (group.parentId === 'root') {
              actionsContact.setValue(['deleteGroup', id])
            }
          })
        }
        
        // Clear all contacts in root
        if (currentStructure?.contacts) {
          currentStructure.contacts.forEach((contact: any, id: string) => {
            if (id.startsWith('root:') && !id.endsWith(':structure') && 
                !id.endsWith(':dynamics') && !id.endsWith(':actions') &&
                !id.endsWith(':properties')) {
              actionsContact.setValue(['deleteContact', id])
            }
          })
        }
        
        self.postMessage({ type: 'ready' })
        break
        
      case 'restore':
        // Restore from saved state
        // This would need more sophisticated implementation to properly
        // restore the entire network structure from a serialized state
        console.log('[Worker] Restore not yet implemented')
        break
        
      default:
        console.warn('Unknown message type:', type)
    }
  }

  // Signal that worker is ready
  self.postMessage({ type: 'ready' })

  // Log for debugging
  console.log('Micro-Bassline worker initialized with network:', network)
  
} catch (error) {
  console.error('Failed to initialize worker:', error)
  self.postMessage({ 
    type: 'error', 
    error: error instanceof Error ? error.message : String(error) 
  })
}