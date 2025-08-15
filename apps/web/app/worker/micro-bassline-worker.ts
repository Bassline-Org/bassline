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

  // Create default project subgroup - all user work happens here
  const defaultProjectId = 'project-default'
  network.createGroup(defaultProjectId, undefined, {
    'expose-structure': true,
    'expose-dynamics': true,
    'allow-meta-mutation': true,
    name: 'Default Project',
    description: 'Default workspace for user operations'
  }, 'root') // Parent is root

  // Track active project
  let activeProjectId = defaultProjectId

  // Get references to ROOT's MGP contacts for project management
  const rootStructureContact = network.contacts.get('root:structure')
  const rootDynamicsContact = network.contacts.get('root:dynamics')
  const rootActionsContact = network.contacts.get('root:actions')
  
  // Get references to the default project's MGP contacts for actual work
  const projectStructureContact = network.contacts.get(`${defaultProjectId}:structure`)
  const projectDynamicsContact = network.contacts.get(`${defaultProjectId}:dynamics`)
  const projectActionsContact = network.contacts.get(`${defaultProjectId}:actions`)

  if (!rootStructureContact || !rootDynamicsContact || !rootActionsContact) {
    throw new Error('Failed to initialize root MGP contacts')
  }
  
  if (!projectStructureContact || !projectDynamicsContact || !projectActionsContact) {
    throw new Error('Failed to initialize project MGP contacts')
  }
  
  // Track which structure contact we're currently subscribing to
  let currentStructureUnsubscribe: (() => void) | null = null
  let currentDynamicsUnsubscribe: (() => void) | null = null
  
  console.log('[Worker] MGP contacts initialized:', {
    root: !!rootStructureContact,
    project: !!projectStructureContact
  })
  
  // Helper to serialize and send structure
  const sendStructure = (structure: any) => {
    // Structure from MGP contact is already a proper Bassline object with Maps
    const serialized = {
      contacts: Array.from(structure.contacts?.entries() || []),
      groups: Array.from(structure.groups?.entries() || []),
      wires: Array.from(structure.wires?.entries() || [])
    }
    self.postMessage({ 
      type: 'structure', 
      value: serialized
    })
  }

  // Function to subscribe to a specific project's structure
  const subscribeToProject = (projectId: string) => {
    // Unsubscribe from previous subscriptions
    if (currentStructureUnsubscribe) {
      currentStructureUnsubscribe()
      currentStructureUnsubscribe = null
    }
    if (currentDynamicsUnsubscribe) {
      currentDynamicsUnsubscribe()
      currentDynamicsUnsubscribe = null
    }
    
    // Get the project's MGP contacts
    const structureContact = network.contacts.get(`${projectId}:structure`)
    const dynamicsContact = network.contacts.get(`${projectId}:dynamics`)
    
    if (!structureContact || !dynamicsContact) {
      console.warn(`[Worker] Project ${projectId} doesn't have MGP contacts`)
      return
    }
    
    // Subscribe to structure changes
    console.log(`[Worker] Subscribing to ${projectId}:structure`)
    currentStructureUnsubscribe = structureContact.onValueChange(structure => {
      console.log(`[Worker] Structure updated for ${projectId}:`, structure)
      sendStructure(structure)
    })
    
    // Subscribe to dynamics events
    console.log(`[Worker] Subscribing to ${projectId}:dynamics`)
    currentDynamicsUnsubscribe = dynamicsContact.onValueChange(event => {
      console.log(`[Worker] Dynamics event for ${projectId}:`, event)
      self.postMessage({ 
        type: 'dynamics', 
        event 
      })
    })
    
    // Send initial structure
    const initialStructure = structureContact.getValue()
    if (initialStructure) {
      sendStructure(initialStructure)
    }
  }
  
  // Subscribe to the default project initially
  subscribeToProject(defaultProjectId)

  // Handle incoming messages from main thread
  self.onmessage = (e: MessageEvent) => {
    const { type, action, state, projectId } = e.data
    
    switch (type) {
      case 'action':
        // Route action to the active project
        console.log('[Worker] Received action:', action, 'for project:', activeProjectId)
        
        // Transform action to ensure it targets the active project
        let targetAction = action
        if (Array.isArray(action)) {
          const [actionType, ...args] = action
          
          // For create actions, ensure they target the active project
          if (actionType === 'createContact') {
            const [contactId, groupId, properties] = args
            // If no groupId specified, use active project
            targetAction = [actionType, contactId, groupId || activeProjectId, properties]
          } else if (actionType === 'createGroup') {
            const [groupId, parentId, properties] = args
            // If no parentId specified, use active project
            targetAction = [actionType, groupId, parentId || activeProjectId, properties]
          } else if (actionType === 'setValue') {
            const [contactId, value] = args
            // Ensure contact ID is qualified with project ID
            const qualifiedId = contactId.includes(':') ? contactId : `${activeProjectId}:${contactId}`
            targetAction = [actionType, qualifiedId, value]
          }
        }
        
        // Send action to the active project's actions contact
        const projectActionsContact = network.contacts.get(`${activeProjectId}:actions`)
        if (projectActionsContact) {
          projectActionsContact.setValue(targetAction)
        } else {
          console.error(`[Worker] No actions contact for project ${activeProjectId}`)
        }
        // Structure will be updated via dynamics events
        break
        
      case 'setActiveProject':
        // Switch active project
        activeProjectId = projectId || defaultProjectId
        console.log('[Worker] Active project changed to:', activeProjectId)
        
        // Re-subscribe to the new project's MGP contacts
        subscribeToProject(activeProjectId)
        
        self.postMessage({ type: 'activeProjectChanged', projectId: activeProjectId })
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
              rootActionsContact.setValue(['deleteGroup', id])
            }
          })
        }
        
        // Clear all contacts in root
        if (currentStructure?.contacts) {
          currentStructure.contacts.forEach((contact: any, id: string) => {
            if (id.startsWith('root:') && !id.endsWith(':structure') && 
                !id.endsWith(':dynamics') && !id.endsWith(':actions') &&
                !id.endsWith(':properties')) {
              rootActionsContact.setValue(['deleteContact', id])
            }
          })
        }
        
        self.postMessage({ type: 'ready' })
        break
        
      case 'restore':
        // Restore from saved state
        console.log('[Worker] Restoring network state from saved data')
        
        if (state && rootActionsContact) {
          try {
            // The state contains arrays that were serialized from Maps
            // We need to recreate the network structure using actions
            
            // First, create all groups
            if (state.groups && Array.isArray(state.groups)) {
              state.groups.forEach(([groupId, group]: [string, any]) => {
                if (groupId !== 'root' && group.parentId) {
                  // Create subgroup with properties
                  rootActionsContact.setValue(['createGroup', groupId, undefined, group.properties || {}, group.parentId])
                }
              })
            }
            
            // Then create all contacts
            if (state.contacts && Array.isArray(state.contacts)) {
              state.contacts.forEach(([contactId, contact]: [string, any]) => {
                // Skip system contacts (properties, structure, dynamics, actions)
                if (!contactId.endsWith(':properties') && 
                    !contactId.endsWith(':structure') && 
                    !contactId.endsWith(':dynamics') && 
                    !contactId.endsWith(':actions')) {
                  const [groupId, localId] = contactId.split(':')
                  if (groupId && localId) {
                    rootActionsContact.setValue(['createContact', localId, groupId, contact.properties || {}])
                  }
                }
              })
            }
            
            // Finally create all wires
            if (state.wires && Array.isArray(state.wires)) {
              state.wires.forEach(([wireId, wire]: [string, any]) => {
                if (wire.fromId && wire.toId) {
                  rootActionsContact.setValue(['createWire', wireId, wire.fromId, wire.toId, wire.bidirectional !== false])
                }
              })
            }
            
            console.log('[Worker] State restored successfully')
          } catch (e) {
            console.error('[Worker] Failed to restore state:', e)
          }
        }
        break
        
      default:
        console.warn('Unknown message type:', type)
    }
  }

  // Signal that worker is ready
  self.postMessage({ type: 'ready' })
  
  // No need to send initial structure here - subscribeToProject already does it

  // Log for debugging
  console.log('Micro-Bassline worker initialized with network:', network)
  
} catch (error) {
  console.error('Failed to initialize worker:', error)
  self.postMessage({ 
    type: 'error', 
    error: error instanceof Error ? error.message : String(error) 
  })
}