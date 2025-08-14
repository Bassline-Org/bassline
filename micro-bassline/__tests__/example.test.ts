/**
 * Example: Meta-Propagation with Micro-Bassline
 * 
 * This demonstrates:
 * 1. Creating a simple network with an add gadget
 * 2. Setting up event monitoring
 * 3. Wiring contacts to demonstrate propagation
 * 4. Showing how changes propagate and generate events
 */

import {
  Runtime,
  Bassline,
  ReifiedContact,
  ReifiedWire,
  ReifiedGroup,
  PropagationEvent
} from './src/index'

// Create a simple network with an add gadget
function createExampleNetwork(): Bassline {
  const contacts = new Map<string, ReifiedContact>([
    // Add gadget inputs
    ['a', {
      content: 5,
      groupId: 'adder',
      properties: { 
        name: 'a',
        blendMode: 'last'  // Allow replacing values
      }
    }],
    ['b', {
      content: 3,
      groupId: 'adder',
      properties: { 
        name: 'b',
        blendMode: 'last'  // Allow replacing values
      }
    }],
    
    // Add gadget output
    ['sum', {
      groupId: 'adder',
      properties: { 
        name: 'sum',
        blendMode: 'last'  // Allow replacing output
      }
    }],
    
    
    // Logger input (stream contact)
    ['log-input', {
      groupId: 'logger',
      properties: {
        name: 'log',
        blendMode: 'last'  // Stream contact to receive events
      }
    }]
  ])
  
  const groups = new Map<string, ReifiedGroup>([
    // Add gadget
    ['adder', {
      contactIds: new Set(['a', 'b', 'sum']),
      boundaryContactIds: new Set(['a', 'b', 'sum']),
      primitiveType: 'add',
      properties: {}
    }],
    
    
    // Logger group (just for organization)
    ['logger', {
      contactIds: new Set(['log-input']),
      boundaryContactIds: new Set(['log-input']),
      properties: {}
    }]
  ])
  
  const wires = new Map<string, ReifiedWire>([])
  
  return {
    contacts,
    wires,
    groups,
    properties: {
      'throw-on-missing-contact': true  // Strict mode for debugging
    }
  }
}

// Run the example
async function runExample() {
  console.log('=== Micro-Bassline Meta-Propagation Example ===\n')
  
  // Create the network
  const bassline = createExampleNetwork()
  
  // Create runtime
  const runtime = new Runtime(bassline)
  
  // Set up event logging
  const eventLog: PropagationEvent[] = []
  runtime.onEvent((event) => {
    eventLog.push(event)
    
    // Log specific event types
    if (event[0] === 'valueChanged') {
      const [, contactId, oldValue, newValue] = event
      console.log(`📝 Value changed: ${contactId}: ${oldValue} → ${newValue}`)
    } else if (event[0] === 'gadgetActivated') {
      const [, gadgetId] = event
      console.log(`⚙️  Gadget activated: ${gadgetId}`)
    } else if (event[0] === 'converged') {
      console.log(`✅ Network converged`)
    }
  })
  
  // Also set up a handler for the log-input contact to show stream processing
  runtime.onEvent((event) => {
    if (event[0] === 'valueChanged' && event[1] === 'log-input') {
      const newValue = event[3]
      if (Array.isArray(newValue)) {
        console.log(`📊 Logger received ${newValue.length} events`)
      }
    }
  })
  
  console.log('Initial state:')
  console.log('  a = 5')
  console.log('  b = 3')
  console.log('  sum = undefined')
  console.log()
  
  // The add gadget should have already executed on initialization
  // because both inputs have values
  await new Promise(resolve => setTimeout(resolve, 10))
  
  const sumValue = runtime.getValue('sum')
  console.log(`After propagation:`)
  console.log(`  sum = ${sumValue}`)
  console.log()
  
  // Now change input 'a'
  console.log('Changing a to 10...')
  runtime.setValue('a', 10)
  
  await new Promise(resolve => setTimeout(resolve, 10))
  
  const newSumValue = runtime.getValue('sum')
  console.log(`After change:`)
  console.log(`  a = 10`)
  console.log(`  b = 3`)
  console.log(`  sum = ${newSumValue}`)
  console.log()
  
  // Get the current structure snapshot directly from runtime
  const structure = runtime.getBassline()
  console.log('📸 Network structure snapshot:')
  console.log(`  ${structure.contacts.size} contacts`)
  console.log(`  ${structure.wires.size} wires`)
  console.log(`  ${structure.groups.size} groups`)
  
  console.log()
  console.log(`Total events captured: ${eventLog.length}`)
  
  // Show that stream contacts work
  console.log('\n=== Stream Contact Behavior ===')
  console.log('Sending multiple values to log-input (stream contact)...')
  
  runtime.setValue('log-input', { event: 1 })
  runtime.setValue('log-input', { event: 2 })
  runtime.setValue('log-input', { event: 3 })
  
  console.log('Each value triggers independently (no merging)')
  
  // Test contradiction handling
  console.log('\n=== Contradiction Handling ===')
  
  // Create a contact with merge blend mode
  runtime.applyAction(['createContact', 'merge-test', undefined, {
    blendMode: 'merge'
  }])
  
  runtime.setValue('merge-test', 42)
  console.log('Set merge-test to 42')
  
  try {
    runtime.setValue('merge-test', 100)
    console.log('Set merge-test to 100 - should cause contradiction')
  } catch (e) {
    // Will be caught internally and logged as warning
  }
  
  console.log('\n=== Example Complete ===')
}

// Export for testing
export { runExample }

// Run as test
import { describe, it } from 'vitest'

describe('Example', () => {
  it('should run the example without errors', async () => {
    await runExample()
  })
})