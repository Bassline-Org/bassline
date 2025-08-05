import { NetworkClient } from '~/propagation-core-v2/worker/network-client'

// Singleton instance
let networkClient: NetworkClient | null = null

/**
 * Get the singleton NetworkClient instance
 * Creates the client on first access
 */
export function getNetworkClient(): NetworkClient {
  if (!networkClient) {
    networkClient = new NetworkClient({
      onReady: () => {
        console.log('Network client ready')
      },
      onChanges: (changes) => {
        console.log('Network changes:', changes)
        // Changes are handled by individual component subscriptions
        // No need for global invalidation
      }
    })
  }
  return networkClient
}

// Track the current demo group ID to prevent re-initialization
let currentDemoGroupId: string | null = null

/**
 * Initialize the network with a basic setup for demo purposes
 */
export async function initializeDemoNetwork(): Promise<string> {
  const client = getNetworkClient()
  
  // If we already have a demo group, return it
  if (currentDemoGroupId) {
    console.log('Returning existing demo group:', currentDemoGroupId)
    return currentDemoGroupId
  }
  
  try {
    // First, ensure the worker has a root group
    await client.registerGroup({
      id: 'root',
      name: 'Root Group',
      contactIds: [],
      wireIds: [],
      subgroupIds: [],
      boundaryContactIds: []
    })
  } catch (e) {
    console.log('Root group already exists')
  }
  
  // Create demo group
  const demoGroupId = await client.addGroup('root', {
    name: 'Demo Network'
  })
  
  // Create some regular contacts
  const input1Id = await client.addContact(demoGroupId, {
    content: 5,
    blendMode: 'accept-last',
    groupId: demoGroupId
  })
  
  const input2Id = await client.addContact(demoGroupId, {
    content: 7,
    blendMode: 'accept-last',
    groupId: demoGroupId
  })
  
  // Create an adder gadget
  const adderGroupId = await client.addGroup(demoGroupId, {
    name: 'Adder',
    primitive: {
      id: 'add',
      // The primitive function is resolved in the worker
    }
  })
  
  // Create boundary contacts for the adder
  const adderInput1 = await client.addContact(adderGroupId, {
    content: 0,
    blendMode: 'accept-last',
    groupId: adderGroupId,
    isBoundary: true
  })
  
  const adderInput2 = await client.addContact(adderGroupId, {
    content: 0,
    blendMode: 'accept-last',
    groupId: adderGroupId,
    isBoundary: true
  })
  
  const adderOutput = await client.addContact(adderGroupId, {
    content: 0,
    blendMode: 'accept-last',
    groupId: adderGroupId,
    isBoundary: true
  })
  
  // Create a multiplier gadget
  const multiplierGroupId = await client.addGroup(demoGroupId, {
    name: 'Multiplier',
    primitive: {
      id: 'multiply',
    }
  })
  
  // Create boundary contacts for the multiplier
  const multInput1 = await client.addContact(multiplierGroupId, {
    content: 0,
    blendMode: 'accept-last',
    groupId: multiplierGroupId,
    isBoundary: true
  })
  
  const multInput2 = await client.addContact(multiplierGroupId, {
    content: 2,
    blendMode: 'accept-last',
    groupId: multiplierGroupId,
    isBoundary: true
  })
  
  const multOutput = await client.addContact(multiplierGroupId, {
    content: 0,
    blendMode: 'accept-last',
    groupId: multiplierGroupId,
    isBoundary: true
  })
  
  // Create a contact with merge blend mode to demonstrate merging
  const mergeContact = await client.addContact(demoGroupId, {
    content: createGrowSet([10, 20]),
    blendMode: 'merge',
    groupId: demoGroupId
  })
  
  // Wire up the network
  // Connect inputs to adder
  await client.connect(input1Id, adderInput1, 'directed')
  await client.connect(input2Id, adderInput2, 'directed')
  
  // Connect adder output to multiplier input
  await client.connect(adderOutput, multInput1, 'directed')
  
  // Also connect input1 to merge contact
  await client.connect(input1Id, mergeContact, 'directed')
  
  // Connect multiplier output to merge contact
  await client.connect(multOutput, mergeContact, 'directed')
  
  console.log('Demo network initialized with group:', demoGroupId)
  console.log('Created contacts:', [contact1Id, contact2Id, contact3Id])
  
  // Store the demo group ID to prevent re-initialization
  currentDemoGroupId = demoGroupId
  
  return demoGroupId
}

/**
 * Reset the singleton (useful for testing)
 */
export function resetNetworkClient(): void {
  if (networkClient) {
    networkClient.terminate()
    networkClient = null
  }
  currentDemoGroupId = null
}