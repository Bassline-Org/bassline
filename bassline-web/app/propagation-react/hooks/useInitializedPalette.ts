import { useEffect } from 'react'
import { usePalette } from './usePalette'
import type { PropagationNetwork } from '~/propagation-core'
import type { ContactGroup } from '~/propagation-core/models/ContactGroup'

export function useInitializedPalette(network: PropagationNetwork) {
  const palette = usePalette()
  
  useEffect(() => {
    // Extract all gadgets from the network and add them to the palette
    const extractGadgetsRecursively = (group: ContactGroup) => {
      // Add each subgroup as a gadget template
      for (const subgroup of group.subgroups.values()) {
        const template = subgroup.toTemplate()
        
        // Check if this gadget already exists in the palette
        const exists = palette.items.some(item => 
          item.name === template.name && 
          item.contacts.length === template.contacts.length &&
          item.wires.length === template.wires.length
        )
        
        if (!exists) {
          // Add category based on gadget characteristics
          let category = 'Custom'
          if (subgroup.isPrimitive) {
            category = 'Primitives'
          } else if (template.boundaryIndices.length > 0) {
            category = 'Gadgets'
          }
          
          palette.addToPalette({
            ...template,
            category,
            description: `Loaded from ${group.name}`
          })
        }
        
        // Recursively extract from subgroups
        extractGadgetsRecursively(subgroup)
      }
    }
    
    // Start extraction from the root group
    extractGadgetsRecursively(network.rootGroup)
  }, []) // Only run once on mount
  
  return palette
}