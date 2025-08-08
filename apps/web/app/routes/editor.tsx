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