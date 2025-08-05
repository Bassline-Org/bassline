import type { MetaFunction } from "react-router";
import { useLoaderData, useSubmit } from "react-router";
import { ReactFlow, Background, useNodesState, useEdgesState, type Node, type Edge } from '@xyflow/react'
import { useGroupState } from "~/hooks/useWorkerData";
import { getNetworkClient, initializeDemoNetwork } from "~/network/client";
import { DemoContactNode } from "~/components/demo/DemoContactNode";
import { SimpleNetworkFlow } from "~/components/demo/SimpleNetworkFlow";
import type { GroupState } from "~/propagation-core-v2/types";
import '@xyflow/react/dist/style.css';

export const meta: MetaFunction = () => {
  return [
    { title: "Worker Demo - Bassline" },
    { name: "description", content: "Demo of worker integration with React Router" },
  ];
};

export async function clientLoader() {
  try {
    const client = getNetworkClient()
    
    console.log('Demo: Initializing network...')
    
    // Always initialize a fresh demo network for now
    // This ensures we have data to work with
    const demoGroupId = await initializeDemoNetwork()
    
    console.log('Demo: Getting group state for:', demoGroupId)
    
    // Get initial group state
    const groupState = await client.getState(demoGroupId)
    
    console.log('Demo: Group state loaded:', {
      groupId: demoGroupId,
      contacts: groupState.contacts.size,
      wires: groupState.wires.size,
      contactsArray: Array.from(groupState.contacts.values()),
      wiresArray: Array.from(groupState.wires.values())
    })
    
    return {
      demoGroupId,
      initialGroupState: groupState
    }
  } catch (error) {
    console.error('Demo: Error in clientLoader:', error)
    throw error
  }
}

export default function Demo() {
  const { demoGroupId, initialGroupState } = useLoaderData<typeof clientLoader>()
  const submit = useSubmit()
  
  // Subscribe to real-time group state updates  
  const { state: groupState, loading, error } = useGroupState(demoGroupId, initialGroupState as GroupState)
  
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading network...</div>
      </div>
    )
  }
  
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-red-500">Error: {error.message}</div>
      </div>
    )
  }
  
  if (!groupState) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-500">No group state available</div>
      </div>
    )
  }
  
  // Handle adding a new contact
  const handleAddContact = () => {
    console.log('handleAddContact called with groupId:', demoGroupId)
    submit({
      intent: 'add-contact',
      groupId: demoGroupId,
      content: JSON.stringify(`New Contact ${Date.now()}`),
      blendMode: 'accept-last'
    }, {
      method: 'post',
      action: '/api/demo',
      navigate: false
    })
  }
  
  return (
    <div className="h-screen w-screen flex flex-col">
      <div className="bg-gray-100 p-4 border-b">
        <h1 className="text-2xl font-bold">Worker Integration Demo</h1>
        <div className="flex items-center gap-4 mt-2">
          <span className="text-sm text-gray-600">
            Group: {groupState.group.name} ({groupState.contacts.size} contacts, {groupState.wires.size} wires)
          </span>
          <button 
            onClick={handleAddContact}
            className="bg-blue-500 text-white px-3 py-1 rounded text-sm hover:bg-blue-600"
          >
            Add Contact
          </button>
        </div>
      </div>
      
      <div className="flex-1">
        <SimpleNetworkFlow 
          groupState={groupState} 
          groupId={demoGroupId}
        />
      </div>
    </div>
  )
}