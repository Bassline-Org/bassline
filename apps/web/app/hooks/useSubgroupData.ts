import { useState, useEffect } from 'react'
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
  
  useEffect(() => {
    const fetchSubgroupData = async () => {
      const client = getNetworkClient()
      const newData = new Map<string, SubgroupInfo>()
      
      for (const subgroupId of subgroupIds) {
        try {
          const state = await client.getState(subgroupId)
          const groupState = state as GroupState
          const group = groupState.group
          console.log(`[useSubgroupData] Fetched subgroup ${subgroupId}:`, group)
          
          // Extract boundary contacts
          const boundaryContacts: SubgroupInfo['boundaryContacts'] = []
          if (group.boundaryContactIds.length > 0) {
            groupState.contacts.forEach((contact) => {
              if (contact.isBoundary) {
                boundaryContacts.push({
                  id: contact.id,
                  name: contact.name || contact.id,
                  boundaryDirection: contact.boundaryDirection || 'input'
                })
              }
            })
          }
          
          newData.set(subgroupId, {
            id: subgroupId,
            name: group.name,
            primitiveId: group.primitiveId,
            boundaryContacts
          })
        } catch (error) {
          console.warn(`Failed to fetch subgroup ${subgroupId}:`, error)
          // Use fallback data
          newData.set(subgroupId, {
            id: subgroupId,
            name: `Group ${subgroupId.slice(0, 8)}`,
            primitiveId: undefined,
            boundaryContacts: []
          })
        }
      }
      
      setSubgroupData(newData)
    }
    
    if (subgroupIds.length > 0) {
      fetchSubgroupData()
    }
  }, [subgroupIds.join(',')]) // Use join to create stable dependency
  
  // Also update when subgroupIds array changes (new gadgets added)
  useEffect(() => {
    console.log('[useSubgroupData] Subgroup IDs changed:', subgroupIds)
  }, [subgroupIds.length])
  
  return subgroupData
}