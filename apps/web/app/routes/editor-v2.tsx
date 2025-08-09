import type { MetaFunction } from "react-router";
import { useLoaderData, useParams } from "react-router";
import { getNetworkClient } from "~/network/client";
import { useGroupState } from "~/hooks/useWorkerData";
import { SimpleEditorFlow } from "~/components/editor-v2/SimpleEditorFlow";
import { TopToolbar } from "~/components/TopToolbar";
import type { GroupState } from '@bassline/core';
import '@xyflow/react/dist/style.css';

export const meta: MetaFunction = () => {
  return [
    { title: "Editor V2 - Bassline" },
    { name: "description", content: "Worker-based propagation network editor" },
  ];
};

export async function clientLoader({ params, request }: { params: { groupId?: string }; request: Request }) {
  // Parse URL params from the request
  const url = new URL(request.url)
  const roomCode = url.searchParams.get('room')
  const serverUrl = url.searchParams.get('server')
  const signalingUrl = url.searchParams.get('signal')
  
  // Clear localStorage if no URL params (force default to local mode)
  if (!roomCode && !serverUrl) {
    localStorage.removeItem('bassline-network-config')
  }
  
  // If we have URL params, save them to localStorage so getNetworkClient picks them up
  if (roomCode || serverUrl) {
    // Use the same host as the current page for signaling server
    const defaultSignalingUrl = `ws://${url.hostname}:8081`
    
    const config = roomCode ? {
      mode: 'webrtc' as const,
      webrtc: {
        roomCode,
        signalingUrl: signalingUrl || defaultSignalingUrl,
        isHost: false
      }
    } : {
      mode: 'remote' as const,
      remoteUrl: serverUrl
    }
    
    localStorage.setItem('bassline-network-config', JSON.stringify(config))
    console.log('[Editor] Saved network config from URL params:', config)
  }
  
  const client = getNetworkClient()
  const groupId = params.groupId || 'root'
  
  console.log('[Editor] Loading group:', groupId)
  
  try {
    // Ensure root group exists
    if (groupId === 'root') {
      try {
        // First check if root group exists
        await client.getState('root')
        console.log('[Editor] Root group already exists')
      } catch (e) {
        // Only create if it doesn't exist
        console.log('[Editor] Creating root group')
        await client.registerGroup({
          id: 'root',
          name: 'Root Group',
          contactIds: [],
          wireIds: [],
          subgroupIds: [],
          boundaryContactIds: []
        })
        console.log('[Editor] Root group created')
      }
    }
    
    // Get the group state
    const groupState = await client.getState(groupId)
    
    console.log('[Editor] Group state loaded:', {
      groupId,
      contacts: groupState.contacts instanceof Map ? groupState.contacts.size : groupState.contacts.length,
      wires: groupState.wires instanceof Map ? groupState.wires.size : groupState.wires.length,
      subgroups: groupState.group.subgroupIds.length
    })
    
    return {
      groupId,
      initialGroupState: groupState
    }
  } catch (error) {
    console.error('[Editor] Error loading group:', error)
    throw error
  }
}

export default function EditorV2() {
  const { groupId, initialGroupState } = useLoaderData<typeof clientLoader>()
  const params = useParams()
  
  // Subscribe to real-time group state updates
  const { state: groupState, loading, error } = useGroupState(
    groupId, 
    initialGroupState as GroupState
  )
  
  // Expose network client globally for debugging
  if (typeof window !== 'undefined') {
    (window as any).getNetworkClient = getNetworkClient
    
    // Expose debugging utilities
    (window as any).forceLocalMode = () => {
      localStorage.removeItem('bassline-network-config')
      location.reload()
    }
    
    (window as any).forceRemoteMode = (url = 'http://localhost:8455') => {
      localStorage.setItem('bassline-network-config', JSON.stringify({
        mode: 'remote',
        remoteUrl: url
      }))
      location.reload()
    }
    
    // Debug connection issues
    (window as any).debugConnection = async () => {
      console.log('=== Connection Debug Test ===')
      
      try {
        const client = getNetworkClient()
        
        // 1. Create a simple contact
        console.log('1. Creating test contact...')
        const contactId = await client.addContact('root', {
          content: 42,
          blendMode: 'accept-last',
          groupId: 'root'
        })
        console.log('   Contact created:', contactId)
        
        // 2. Create a primitive gadget (add gadget)
        console.log('2. Creating add gadget...')
        const addGadgetId = await client.createPrimitiveGadget('root', 'add')
        console.log('   Add gadget created:', addGadgetId)
        
        // 3. Get the gadget state to see boundary contacts
        console.log('3. Getting gadget state...')
        const gadgetState = await client.getState(addGadgetId)
        console.log('   Gadget state:', gadgetState)
        const boundaryContacts = Array.from(gadgetState.contacts.values()).filter(c => c.isBoundary)
        console.log('   Boundary contacts:', boundaryContacts)
        console.log('   Group boundaryContactIds:', gadgetState.group.boundaryContactIds)
        
        // 4. Try to connect the contact to the gadget's first input
        const inputContacts = Array.from(gadgetState.contacts.values()).filter(c => c.isBoundary && c.boundaryDirection === 'input')
        if (inputContacts.length > 0) {
          const inputContactId = inputContacts[0].id
          console.log('4. Attempting connection...')
          console.log('   From:', contactId)
          console.log('   To:', inputContactId)
          
          try {
            const wireId = await client.connect(contactId, inputContactId, 'bidirectional')
            console.log('   ✅ Connection successful! Wire ID:', wireId)
          } catch (connectionError) {
            console.error('   ❌ Connection failed:', connectionError.message)
            
            // Debug: Check if both contacts can be found individually
            console.log('   Debugging contact lookup...')
            try {
              const fromContact = await client.getContact(contactId)
              console.log('   From contact lookup:', fromContact ? '✅ Found' : '❌ Not found')
            } catch (e) {
              console.log('   From contact lookup: ❌ Error:', e.message)
            }
            
            try {
              const toContact = await client.getContact(inputContactId)
              console.log('   To contact lookup:', toContact ? '✅ Found' : '❌ Not found')
            } catch (e) {
              console.log('   To contact lookup: ❌ Error:', e.message)
            }
          }
        } else {
          console.log('   ❌ No input contacts found in gadget')
        }
        
      } catch (error) {
        console.error('Debug test failed:', error)
      }
    }

    // Expose primitive gadget testing utilities
    (window as any).testPrimitiveGadgets = async () => {
      const client = getNetworkClient()
      console.log('Available primitive gadgets:', client.getPrimitiveGadgets())
      
      try {
        const demo = await client.createPrimitiveGadgetDemo('root')
        console.log('Created primitive gadget demo:', demo)
        
        // Test updating input to see if output changes
        console.log('Testing primitive gadget execution...')
        await client.updateContact(demo.inputId, 'root', 7)
        console.log('Updated input to 7, output should now be 10 (7 + 3)')
        
        // Check output after a moment
        setTimeout(async () => {
          const outputContact = await client.getContact(demo.outputId)
          console.log('Output contact value:', outputContact?.content)
        }, 100)
        
        return demo
      } catch (error) {
        console.error('Error testing primitive gadgets:', error)
        throw error
      }
    }
  }
  
  
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="text-lg mb-2">Loading editor...</div>
          <div className="animate-spin text-4xl">⚡</div>
        </div>
      </div>
    )
  }
  
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-red-50">
        <div className="text-center">
          <div className="text-red-600 text-xl mb-2">Error Loading Editor</div>
          <div className="text-red-500">{error.message}</div>
        </div>
      </div>
    )
  }
  
  if (!groupState) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-gray-500">No group state available</div>
      </div>
    )
  }
  
  return (
    <div className="relative h-screen">
      <TopToolbar />
      <SimpleEditorFlow groupState={groupState} groupId={groupId} />
    </div>
  )
}