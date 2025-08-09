/**
 * Example: Loading and using custom primitive modules
 * 
 * This demonstrates how to load custom primitive modules
 * and use them in a Bassline network.
 */

import { KernelClient, UIAdapter } from '@bassline/web'

async function loadCustomPrimitives() {
  // Initialize the kernel client in local mode
  const kernelClient = new KernelClient({
    mode: 'local',
    onReady: () => console.log('Kernel ready'),
    onError: (error) => console.error('Kernel error:', error)
  })
  
  // Create UI adapter
  const uiAdapter = new UIAdapter({ kernelClient })
  
  // Wait for initialization
  await kernelClient.initialize()
  
  // Load the custom primitive module
  // This could be from NPM, a file, or a URL
  await uiAdapter.loadPrimitiveModule({
    type: 'file',
    path: './user-primitives.ts',
    namespace: '@user/custom'
  })
  
  // List all available primitives (including custom ones)
  const primitives = await uiAdapter.getPrimitiveGadgets()
  console.log('Available primitives:', primitives)
  
  // Create a root group for our demo
  const rootGroupId = await uiAdapter.createGroup('Custom Primitives Demo')
  
  // Create instances of custom primitives
  const randomGadgetId = await uiAdapter.createPrimitiveGadgetV2(
    '@user/custom/random',
    rootGroupId
  )
  
  const formatGadgetId = await uiAdapter.createPrimitiveGadgetV2(
    '@user/custom/format',
    rootGroupId
  )
  
  // Get the gadget states to find boundary contacts
  const randomState = await uiAdapter.getState(randomGadgetId)
  const formatState = await uiAdapter.getState(formatGadgetId)
  
  if (!randomState || !formatState) {
    throw new Error('Failed to create gadgets')
  }
  
  // Find boundary contacts
  const randomOutputs = Array.from(randomState.contacts.values())
    .filter(c => c.isBoundary && c.boundaryDirection === 'output')
  
  const formatInputs = Array.from(formatState.contacts.values())
    .filter(c => c.isBoundary && c.boundaryDirection === 'input')
  
  // Wire random output to format input
  if (randomOutputs.length > 0 && formatInputs.length > 0) {
    // Connect random 'value' output to format 'value1' input
    const valueOutput = randomOutputs.find(c => c.name === 'value')
    const templateInput = formatInputs.find(c => c.name === 'template')
    const value1Input = formatInputs.find(c => c.name === 'value1')
    
    if (valueOutput && value1Input && templateInput) {
      // Set the template
      await uiAdapter.updateContact(
        templateInput.id,
        formatGadgetId,
        'Random number: {1}'
      )
      
      // Wire random output to format input
      await uiAdapter.createWire(valueOutput.id, value1Input.id)
      
      // Set min/max for random
      const minInput = Array.from(randomState.contacts.values())
        .find(c => c.name === 'min')
      const maxInput = Array.from(randomState.contacts.values())
        .find(c => c.name === 'max')
      const triggerInput = Array.from(randomState.contacts.values())
        .find(c => c.name === 'trigger')
      
      if (minInput && maxInput && triggerInput) {
        await uiAdapter.updateContact(minInput.id, randomGadgetId, 0)
        await uiAdapter.updateContact(maxInput.id, randomGadgetId, 100)
        
        // Trigger the random generator
        await uiAdapter.updateContact(triggerInput.id, randomGadgetId, true)
      }
    }
  }
  
  // Subscribe to changes to see the results
  uiAdapter.onChanges((changes) => {
    changes.forEach(change => {
      if (change.type === 'contact-updated') {
        const data = change.data as any
        console.log(`Contact ${data.contactId} updated:`, data.value)
      }
    })
  })
  
  return { kernelClient, uiAdapter, rootGroupId }
}

// Example: Loading from NPM package
async function loadFromNPM() {
  const kernelClient = new KernelClient({ mode: 'local' })
  const uiAdapter = new UIAdapter({ kernelClient })
  
  await kernelClient.initialize()
  
  // Load a hypothetical NPM package with custom primitives
  await uiAdapter.loadPrimitiveModule({
    type: 'npm',
    package: '@mycompany/bassline-primitives',
    namespace: '@mycompany'
  })
  
  // Now you can use primitives like:
  // - @mycompany/special-transform
  // - @mycompany/custom-filter
  // etc.
}

// Example: Loading from URL
async function loadFromURL() {
  const kernelClient = new KernelClient({ mode: 'local' })
  const uiAdapter = new UIAdapter({ kernelClient })
  
  await kernelClient.initialize()
  
  // Load primitives from a URL
  await uiAdapter.loadPrimitiveModule({
    type: 'url',
    url: 'https://example.com/primitives.js',
    namespace: '@remote'
  })
  
  // Use the remote primitives
  const gadgetId = await uiAdapter.createPrimitiveGadgetV2(
    '@remote/some-primitive',
    'root-group-id'
  )
}

// Example: Using different schedulers
async function configureScheduler() {
  const kernelClient = new KernelClient({ mode: 'local' })
  const uiAdapter = new UIAdapter({ kernelClient })
  
  await kernelClient.initialize()
  
  // Use batch scheduler for better performance with many updates
  await uiAdapter.setScheduler('batch', {
    batchSize: 20,
    batchDelay: 10
  })
  
  // Or use animation frame scheduler for smooth UI updates
  await uiAdapter.setScheduler('animationFrame')
  
  // Or use priority scheduler for important updates first
  await uiAdapter.setScheduler('priority')
}

// Run the example
if (typeof window !== 'undefined') {
  // Browser environment
  loadCustomPrimitives()
    .then(({ uiAdapter }) => {
      console.log('Custom primitives loaded successfully')
      // Expose to window for debugging
      ;(window as any).bassline = { uiAdapter }
    })
    .catch(console.error)
}