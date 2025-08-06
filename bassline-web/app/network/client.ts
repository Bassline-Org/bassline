import { NetworkClient } from '~/propagation-core-v2/worker/network-client'
import { RemoteNetworkClient } from './remote-client'
import { getNetworkConfig } from '~/config/network-config'
import { grow } from '~/propagation-core-v2/mergeable'

// Re-export types
export type { NetworkClient, NetworkMessage, GroupState } from '~/propagation-core-v2/worker/network-client'

// Singleton instance
let networkClient: NetworkClient | RemoteNetworkClient | null = null

/**
 * Get the singleton NetworkClient instance
 * Creates the client on first access
 */
export function getNetworkClient(): NetworkClient | RemoteNetworkClient {
  if (!networkClient) {
    const config = getNetworkConfig()
    
    if (config.mode === 'remote' && config.remoteUrl) {
      console.log('Creating remote network client:', config.remoteUrl)
      networkClient = new RemoteNetworkClient(config.remoteUrl)
    } else {
      console.log('Creating worker network client')
      networkClient = new NetworkClient({
        onReady: async () => {
          console.log('Network client ready')
          // Ensure root group exists
          try {
            await networkClient!.registerGroup({
              id: 'root',
              name: 'Root Group',
              contactIds: [],
              wireIds: [],
              subgroupIds: [],
              boundaryContactIds: []
            })
            console.log('Root group created')
          } catch (e) {
            console.log('Root group already exists')
          }
        },
        onChanges: (changes) => {
          console.log('Network changes:', changes)
          // Changes are handled by individual component subscriptions
          // No need for global invalidation
        }
      })
    }
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
  
  // For now, let's create a simpler demo without gadgets
  // Just show basic propagation and merge behavior
  
  // Create a contact that will propagate to others
  const sourceContact = await client.addContact(demoGroupId, {
    content: 10,
    blendMode: 'accept-last',
    groupId: demoGroupId
  })
  
  // Create a merge contact to demonstrate GrowSet merging
  const mergeContact1 = await client.addContact(demoGroupId, {
    content: grow.set([1, 2, 3]),
    blendMode: 'merge',
    groupId: demoGroupId
  })
  
  const mergeContact2 = await client.addContact(demoGroupId, {
    content: grow.set([3, 4, 5]),
    blendMode: 'merge',
    groupId: demoGroupId
  })
  
  // Create contacts to demonstrate propagation
  const targetContact1 = await client.addContact(demoGroupId, {
    content: 0,
    blendMode: 'accept-last',
    groupId: demoGroupId
  })
  
  const targetContact2 = await client.addContact(demoGroupId, {
    content: 0,
    blendMode: 'accept-last',
    groupId: demoGroupId
  })
  
  // Wire up the network
  // Source propagates to targets
  await client.connect(sourceContact, targetContact1, 'directed')
  await client.connect(sourceContact, targetContact2, 'bidirectional')
  
  // Connect the merge contacts to demonstrate merge behavior
  await client.connect(mergeContact1, mergeContact2, 'bidirectional')
  
  // Connect source to one of the merge contacts
  await client.connect(sourceContact, mergeContact1, 'directed')
  
  console.log('Demo network initialized with group:', demoGroupId)
  console.log('Created demo with:')
  console.log('- Source contact:', sourceContact)
  console.log('- Target contacts:', [targetContact1, targetContact2])
  console.log('- Merge contacts:', [mergeContact1, mergeContact2])
  
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