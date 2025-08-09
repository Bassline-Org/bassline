import { useState, useEffect, useMemo } from 'react'
import { getNetworkClient } from '~/network/client'
import type { GroupState } from '@bassline/core'

interface SubgroupInfo {
  id: string
  name: string
  primitiveId?: string
  boundaryContacts?: Array<{
    id: string
    name: string
    boundaryDirection: 'input' | 'output'
  }>
}

export function useSubgroupData(subgroupIds: string[]): Map<string, SubgroupInfo> {
  const [subgroupData, setSubgroupData] = useState<Map<string, SubgroupInfo>>(new Map())
  
  // Memoize the subgroup IDs array to prevent unnecessary effects
  const stableSubgroupIds = useMemo(() => subgroupIds, [subgroupIds.join(',')])
  
  useEffect(() => {
    const fetchSubgroupData = async () => {
      const client = getNetworkClient()
      
      setSubgroupData(currentData => {
        const newData = new Map(currentData) // Start with existing data
        const currentIds = new Set(currentData.keys())
        const newIds = new Set(stableSubgroupIds)
        
        // Remove data for subgroups that no longer exist
        for (const id of currentIds) {
          if (!newIds.has(id)) {
            console.log(`[useSubgroupData] Removing subgroup data for ${id}`)
            newData.delete(id)
          }
        }
        
        // Only fetch data for new subgroups
        const subgroupsToFetch = stableSubgroupIds.filter(id => !currentData.has(id))
        console.log(`[useSubgroupData] Need to fetch ${subgroupsToFetch.length} new subgroups`)
        
        // Fetch new subgroups asynchronously and update state
        if (subgroupsToFetch.length > 0) {
          Promise.all(subgroupsToFetch.map(async (subgroupId) => {
            try {
              const state = await client.getState(subgroupId)
              const groupState = state as GroupState
              const group = groupState.group
              console.log(`[useSubgroupData] Fetched subgroup ${subgroupId}:`, group)
              
              // Extract boundary contacts - check all contacts for isBoundary flag
              const boundaryContacts: SubgroupInfo['boundaryContacts'] = []
              console.log(`[useSubgroupData] Checking boundary contacts for ${subgroupId}:`, {
                boundaryContactIds: group.boundaryContactIds,
                totalContacts: groupState.contacts.size,
                contactsWithBoundary: Array.from(groupState.contacts.values()).filter(c => c.isBoundary)
              })
              
              groupState.contacts.forEach((contact) => {
                if (contact.isBoundary) {
                  boundaryContacts.push({
                    id: contact.id,
                    name: contact.name || contact.id,
                    boundaryDirection: contact.boundaryDirection || 'input'
                  })
                  console.log(`[useSubgroupData] Found boundary contact:`, {
                    id: contact.id,
                    name: contact.name,
                    direction: contact.boundaryDirection
                  })
                }
              })
              
              return {
                id: subgroupId,
                info: {
                  id: subgroupId,
                  name: group.name,
                  primitiveId: group.primitive?.name,
                  boundaryContacts
                }
              }
            } catch (error) {
              console.warn(`Failed to fetch subgroup ${subgroupId}:`, error)
              return {
                id: subgroupId,
                info: {
                  id: subgroupId,
                  name: `Group ${subgroupId.slice(0, 8)}`,
                  primitiveId: undefined,
                  boundaryContacts: []
                }
              }
            }
          }))
          .then(results => {
            setSubgroupData(prevData => {
              const updatedData = new Map(prevData)
              for (const { id, info } of results) {
                updatedData.set(id, info)
              }
              return updatedData
            })
          })
        }
        
        return newData
      })
    }
    
    if (stableSubgroupIds.length > 0) {
      fetchSubgroupData()
    } else {
      // Clear all data if no subgroups
      setSubgroupData(new Map())
    }
  }, [stableSubgroupIds])
  
  // Also update when subgroupIds array changes (new gadgets added)
  useEffect(() => {
    console.log('[useSubgroupData] Subgroup IDs changed:', subgroupIds)
  }, [subgroupIds.length])
  
  return subgroupData
}