import { useState, useEffect } from 'react'
import { Outlet, useLoaderData } from 'react-router'
import { getNetworkClient } from '~/network/client'
import { TopToolbar } from '~/components/TopToolbar'
import { ClientOnly } from '~/components/ClientOnly'
import type { GroupState } from '@bassline/core'

// Loader to fetch initial group state
export async function clientLoader({ params }: { params: { groupId?: string } }) {
  const client = getNetworkClient()
  const groupId = params.groupId || 'root'
  
  console.log('[EditorLayout] Loading group:', groupId)
  
  try {
    // Ensure root group exists
    if (groupId === 'root') {
      try {
        await client.getState('root')
        console.log('[EditorLayout] Root group already exists')
      } catch (e) {
        console.log('[EditorLayout] Creating root group')
        await client.registerGroup({
          id: 'root',
          name: 'Root Group',
          contactIds: [],
          wireIds: [],
          subgroupIds: [],
          boundaryContactIds: []
        })
      }
    }
    
    // Get the group state
    const groupState = await client.getState(groupId)
    
    console.log('[EditorLayout] Group state loaded:', {
      groupId,
      contacts: groupState.contacts instanceof Map ? groupState.contacts.size : 0,
      wires: groupState.wires instanceof Map ? groupState.wires.size : 0,
      subgroups: groupState.group.subgroupIds.length
    })
    
    return { groupId, groupState }
  } catch (error) {
    console.error('[EditorLayout] Error loading group:', error)
    throw error
  }
}

// Context type for child routes
export type EditorLayoutContext = {
  groupState: GroupState
  groupId: string
  setGroupState: (state: GroupState) => void
}

// shouldRevalidate to control when loader reruns
export function shouldRevalidate({ 
  currentParams, 
  nextParams,
  formAction,
}: any) {
  console.log('[EditorLayout.shouldRevalidate] Called', {
    currentParams,
    nextParams,
    formAction
  })
  
  // Only revalidate if navigating to different group
  if (currentParams?.groupId !== nextParams?.groupId) {
    console.log('[EditorLayout.shouldRevalidate] Different group, revalidating')
    return true
  }
  
  // Skip revalidation for actions
  if (formAction?.includes('/api/editor/actions')) {
    console.log('[EditorLayout.shouldRevalidate] Skipping for action')
    return false
  }
  
  return false
}

export default function EditorLayout() {
  const loaderData = useLoaderData<typeof clientLoader>()
  console.log('[EditorLayout] Loader data:', loaderData)
  console.log('[EditorLayout] Loader data type:', typeof loaderData)
  
  // Check if loaderData itself is valid
  if (!loaderData || typeof loaderData !== 'object') {
    console.error('[EditorLayout] Invalid loader data:', loaderData)
    throw new Error('Invalid loader data')
  }
  
  const { groupId, groupState: initialState } = loaderData
  
  console.log('[EditorLayout] groupId:', groupId, 'type:', typeof groupId)
  console.log('[EditorLayout] initialState:', initialState, 'type:', typeof initialState)
  
  // Validate initial state
  if (!initialState || typeof initialState !== 'object') {
    console.error('[EditorLayout] Invalid initial state:', initialState)
    throw new Error('Invalid initial state from loader')
  }
  
  // Check if it's accidentally a function
  if (typeof initialState === 'function') {
    console.error('[EditorLayout] Initial state is a function!', initialState.toString())
    throw new Error('Initial state is a function instead of an object')
  }
  
  const [groupState, setGroupState] = useState<GroupState>(initialState)
  
  console.log('[EditorLayout] Rendering, groupId:', groupId, 'initial state valid:', !!initialState)
  
  // Set up subscription at layout level
  useEffect(() => {
    const client = getNetworkClient()
    console.log('[EditorLayout] Setting up subscription for group:', groupId)
    console.log('[EditorLayout] Client type:', typeof client)
    console.log('[EditorLayout] Client.subscribe type:', typeof client.subscribe)
    console.log('[EditorLayout] Client.getState type:', typeof client.getState)
    
    // Subscribe to group-specific changes
    const unsubscribe = client.subscribe(groupId, (changes: any[]) => {
      console.log('[EditorLayout] Changes detected:', changes.length, 'changes')
      
      // Refetch state when changes occur
      client.getState(groupId).then(newState => {
        console.log('[EditorLayout] Got state response type:', typeof newState)
        console.log('[EditorLayout] Got state response value:', newState)
        
        // Check if it's a function first
        if (typeof newState === 'function') {
          console.error('[EditorLayout] ERROR: getState returned a function instead of an object!')
          console.error('[EditorLayout] Function toString:', newState.toString())
          return
        }
        
        // Validate that we got a proper GroupState object
        if (newState && typeof newState === 'object' && 'contacts' in newState && 'wires' in newState && 'group' in newState) {
          try {
            console.log('[EditorLayout] Valid state received with:', {
              contacts: newState.contacts instanceof Map ? newState.contacts.size : 'not a Map',
              wires: newState.wires instanceof Map ? newState.wires.size : 'not a Map',
              hasGroup: !!newState.group
            })
            setGroupState(newState as GroupState)
          } catch (err) {
            console.error('[EditorLayout] Error accessing state properties:', err)
          }
        } else {
          console.error('[EditorLayout] Invalid state received:', newState)
          console.error('[EditorLayout] State type:', typeof newState)
          if (newState && typeof newState === 'object') {
            console.error('[EditorLayout] State keys:', Object.keys(newState))
          }
        }
      }).catch(err => {
        console.error('[EditorLayout] Error fetching state:', err)
      })
    })
    
    return () => {
      console.log('[EditorLayout] Cleaning up subscription')
      unsubscribe()
    }
  }, [groupId])
  
  // Provide context to child routes
  const contextValue: EditorLayoutContext = {
    groupState,
    groupId,
    setGroupState
  }
  
  // Debug: Store state info in localStorage for debugging (client-side only)
  useEffect(() => {
    // Only run on client side
    if (typeof window === 'undefined') return
    
    try {
      // Store debug info in localStorage
      localStorage.setItem('bassline-debug-groupId', groupId)
      localStorage.setItem('bassline-debug-groupState', JSON.stringify({
        contactsCount: groupState.contacts instanceof Map ? groupState.contacts.size : 0,
        wiresCount: groupState.wires instanceof Map ? groupState.wires.size : 0,
        subgroupsCount: groupState.group.subgroupIds.length
      }))
      
      // Also expose getNetworkClient for debugging
      (window as any).getNetworkClient = getNetworkClient
    } catch (e) {
      // Ignore errors from localStorage or JSON.stringify
      console.error('[EditorLayout] Debug storage error:', e)
    }
  }, [groupState, groupId])
  
  return (
    <div className="h-screen flex flex-col">
      <TopToolbar />
      <div className="flex-1 overflow-hidden">
        <Outlet context={contextValue} />
      </div>
    </div>
  )
}