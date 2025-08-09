import { getNetworkClient } from '~/network/client'
import { generateId } from '~/utils/id'

export async function clientAction({ request }: { request: Request }) {
  const client = getNetworkClient()
  const formData = await request.formData()
  const intent = formData.get('intent') as string
  
  console.log('[EditorAction] Received:', intent)
  console.log('[EditorAction] Form data:', Object.fromEntries(formData.entries()))
  console.log('[EditorAction] Request URL:', request.url)
  
  try {
    switch (intent) {
      // Contact operations
      case 'add-contact': {
        const groupId = formData.get('groupId') as string
        const content = JSON.parse(formData.get('content') as string)
        const blendMode = formData.get('blendMode') as 'accept-last' | 'merge'
        const position = formData.get('position') ? JSON.parse(formData.get('position') as string) : undefined
        
        const contactId = await client.addContact(groupId, {
          content,
          blendMode,
          groupId
        })
        
        // Note: Position is now handled in the UI component state
        console.log('[EditorAction] Contact added:', contactId, position)
        
        return { 
          success: true, 
          contactId,
          message: 'Contact added successfully' 
        }
      }
      
      case 'update-contact': {
        const contactId = formData.get('contactId') as string
        const content = JSON.parse(formData.get('content') as string)
        const groupId = formData.get('groupId') as string || 'root'
        
        await client.updateContact(contactId, groupId, content)
        
        return { 
          success: true, 
          message: 'Contact updated successfully' 
        }
      }
      
      case 'update-contact-position': {
        const contactId = formData.get('contactId') as string
        const position = JSON.parse(formData.get('position') as string)
        
        // Position is handled in UI state, not in the propagation network
        console.log('[EditorAction] Position update handled in UI:', { contactId, position })
        
        return { 
          success: true, 
          message: 'Position updated' 
        }
      }
      
      case 'delete-contact': {
        const contactId = formData.get('contactId') as string
        
        await client.removeContact(contactId)
        
        // Position cleanup is handled in UI state
        
        return { 
          success: true, 
          message: 'Contact deleted successfully' 
        }
      }
      
      case 'move-contact': {
        const contactId = formData.get('contactId') as string
        const targetGroupId = formData.get('targetGroupId') as string
        
        // TODO: Implement contact moving between groups
        console.log('[EditorAction] Move contact not yet implemented:', { contactId, targetGroupId })
        
        return { 
          success: false, 
          error: 'Move contact not implemented' 
        }
      }
      
      // Group operations
      case 'add-group': {
        const parentGroupId = formData.get('parentGroupId') as string
        const name = formData.get('name') as string
        const position = formData.get('position') ? JSON.parse(formData.get('position') as string) : undefined
        
        const groupId = generateId()
        
        // Register the new group
        await client.registerGroup({
          id: groupId,
          name,
          contactIds: [],
          wireIds: [],
          subgroupIds: [],
          boundaryContactIds: []
        })
        
        // TODO: Add group to parent group's subgroupIds
        console.log('[EditorAction] Adding group to parent not yet implemented')
        
        return { 
          success: true, 
          groupId,
          message: 'Group created successfully' 
        }
      }
      
      case 'update-group': {
        const groupId = formData.get('groupId') as string
        const name = formData.get('name') as string
        
        // TODO: Implement group update
        console.log('[EditorAction] Update group not yet implemented:', { groupId, name })
        
        return { 
          success: false, 
          error: 'Update group not implemented' 
        }
      }
      
      case 'delete-group': {
        const groupId = formData.get('groupId') as string
        
        // Remove the group
        await client.removeGroup(groupId)
        
        // Note: The worker should handle removing it from parent's subgroupIds
        console.log('[EditorAction] Group deleted:', groupId)
        
        return { 
          success: true, 
          message: 'Group deleted successfully' 
        }
      }
      
      // Wire operations
      case 'create-wire': {
        const fromId = formData.get('fromId') as string
        const toId = formData.get('toId') as string
        const type = (formData.get('type') || 'bidirectional') as 'bidirectional' | 'directed'
        
        const wireId = await client.connect(fromId, toId, type)
        
        return { 
          success: true, 
          wireId,
          message: 'Wire created successfully' 
        }
      }
      
      case 'update-wire': {
        const wireId = formData.get('wireId') as string
        const type = formData.get('type') as 'bidirectional' | 'directed'
        
        // TODO: Implement wire type update
        console.log('[EditorAction] Update wire not yet implemented:', { wireId, type })
        
        return { 
          success: false, 
          error: 'Update wire not implemented' 
        }
      }
      
      case 'delete-wire': {
        const wireId = formData.get('wireId') as string
        
        await client.disconnect(wireId)
        
        return { 
          success: true, 
          message: 'Wire deleted successfully' 
        }
      }
      
      // Primitive gadget operations
      case 'create-gadget': {
        const groupId = formData.get('groupId') as string
        const gadgetType = formData.get('gadgetType') as string
        const position = formData.get('position') ? JSON.parse(formData.get('position') as string) : { x: 200, y: 200 }
        
        console.log('[EditorAction] Creating gadget:', { groupId, gadgetType, position })
        
        // Create a display name for the gadget
        const gadgetName = gadgetType.charAt(0).toUpperCase() + gadgetType.slice(1)
        
        // Register the gadget group with the primitive
        const result = await client.addGroup(groupId, {
          name: gadgetName,
          primitiveId: gadgetType
        })
        
        console.log('[EditorAction] Gadget group created:', result, 'in parent:', groupId)
        
        // Position is handled in UI state
        
        return { 
          success: true, 
          groupId: result,
          message: 'Gadget created successfully' 
        }
      }
      
      case 'update-gadget-params': {
        const gadgetId = formData.get('gadgetId') as string
        const params = JSON.parse(formData.get('params') as string)
        
        // TODO: Implement gadget parameter update
        console.log('[EditorAction] Update gadget params not yet implemented:', { gadgetId, params })
        
        return { 
          success: false, 
          error: 'Update gadget params not implemented' 
        }
      }
      
      // Batch operations
      case 'batch-update': {
        const updates = JSON.parse(formData.get('updates') as string)
        
        // TODO: Implement batch updates
        console.log('[EditorAction] Batch update not yet implemented:', { updates })
        
        return { 
          success: false, 
          error: 'Batch update not implemented' 
        }
      }
      
      // Refactoring operations
      case 'extract-to-group': {
        const contactIds = JSON.parse(formData.get('contactIds') as string) as string[]
        const groupName = formData.get('groupName') as string
        const parentGroupId = formData.get('parentGroupId') as string
        
        console.log('[EditorAction] Extract to group:', { contactIds, groupName, parentGroupId })
        
        const result = await client.applyRefactoring('extract-to-group', {
          contactIds,
          groupName,
          parentGroupId
        })
        
        return { 
          success: true, 
          result,
          message: 'Contacts extracted to new group' 
        }
      }
      
      case 'inline-group': {
        const groupId = formData.get('groupId') as string
        
        console.log('[EditorAction] Inline group:', { groupId })
        
        const result = await client.applyRefactoring('inline-group', {
          groupId
        })
        
        return { 
          success: true, 
          result,
          message: 'Group inlined successfully' 
        }
      }
      
      case 'copy-contacts': {
        const contactIds = JSON.parse(formData.get('contactIds') as string) as string[]
        const targetGroupId = formData.get('targetGroupId') as string
        const includeWires = formData.get('includeWires') === 'true'
        
        console.log('[EditorAction] Copy contacts:', { contactIds, targetGroupId, includeWires })
        
        const result = await client.applyRefactoring('copy-contacts', {
          contactIds,
          targetGroupId,
          includeWires
        })
        
        return { 
          success: true, 
          result,
          message: 'Contacts copied successfully' 
        }
      }
      
      case 'copy-group': {
        const groupId = formData.get('groupId') as string
        const targetParentId = formData.get('targetParentId') as string
        const newName = formData.get('newName') as string | null
        const deep = formData.get('deep') === 'true'
        
        console.log('[EditorAction] Copy group:', { groupId, targetParentId, newName, deep })
        
        const result = await client.applyRefactoring('copy-group', {
          groupId,
          targetParentId,
          newName: newName || undefined,
          deep
        })
        
        return { 
          success: true, 
          result,
          message: 'Group copied successfully' 
        }
      }
      
      case 'copy-selection': {
        const contactIds = JSON.parse(formData.get('contactIds') as string) as string[]
        const groupIds = JSON.parse(formData.get('groupIds') as string) as string[]
        const targetGroupId = formData.get('targetGroupId') as string
        const includeWires = formData.get('includeWires') === 'true'
        const deep = formData.get('deep') === 'true'
        
        console.log('[EditorAction] Copy selection:', { contactIds, groupIds, targetGroupId, includeWires, deep })
        
        const result = await client.applyRefactoring('copy-selection', {
          contactIds,
          groupIds,
          targetGroupId,
          includeWires,
          deep
        })
        
        return { 
          success: true, 
          result,
          message: 'Selection copied successfully' 
        }
      }
      
      default:
        return { 
          success: false, 
          error: `Unknown intent: ${intent}` 
        }
    }
  } catch (error) {
    console.error('[EditorAction] Error:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    }
  }
}