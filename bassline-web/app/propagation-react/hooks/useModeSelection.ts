import { useMemo } from 'react'
import { useEditorState } from '../contexts/EditorStateContext'
import { useNetworkContext } from '../contexts/NetworkContext'
import type { Selection } from '../modes/types'

/**
 * Adapter hook that provides Selection interface expected by mode system
 * Bridges EditorState selection structure to mode Selection interface
 */
export function useModeSelection(): Selection {
  const { selection, setSelection } = useEditorState()
  const { network } = useNetworkContext()
  
  return useMemo((): Selection => {
    // Create a Set that combines contactIds and groupIds as "nodes"
    const nodes = new Set<string>([
      ...selection.contactIds,
      ...selection.groupIds
    ])
    
    return {
      nodes,
      edges: new Set<string>(), // We don't track edge selection yet
      
      isEmpty() {
        return nodes.size === 0
      },
      
      has(id: string) {
        return nodes.has(id)
      },
      
      clear() {
        setSelection([], [])
      },
      
      add(id: string) {
        const contactIds = Array.from(selection.contactIds)
        const groupIds = Array.from(selection.groupIds)
        
        // Check if it's a contact or group
        if (network.currentGroup.contacts.has(id)) {
          if (!contactIds.includes(id)) {
            contactIds.push(id)
          }
        } else if (network.currentGroup.subgroups.has(id)) {
          if (!groupIds.includes(id)) {
            groupIds.push(id)
          }
        }
        
        setSelection(contactIds, groupIds)
      },
      
      remove(id: string) {
        const contactIds = Array.from(selection.contactIds).filter(cId => cId !== id)
        const groupIds = Array.from(selection.groupIds).filter(gId => gId !== id)
        setSelection(contactIds, groupIds)
      },
      
      toggle(id: string) {
        if (this.has(id)) {
          this.remove(id)
        } else {
          this.add(id)
        }
      },
      
      replace(ids: string[]) {
        const contactIds: string[] = []
        const groupIds: string[] = []
        
        // Properly separate contacts and groups
        for (const id of ids) {
          if (network.currentGroup.contacts.has(id)) {
            contactIds.push(id)
          } else if (network.currentGroup.subgroups.has(id)) {
            groupIds.push(id)
          }
        }
        
        setSelection(contactIds, groupIds)
      }
    }
  }, [selection, setSelection, network])
}