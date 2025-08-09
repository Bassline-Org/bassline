import { getNetworkClient } from '~/network/client'

export async function clientAction({ request }: { request: Request }) {
  const client = getNetworkClient()
  const formData = await request.formData()
  const intent = formData.get('intent') as string
  
  console.log('Demo action received:', intent)
  console.log('Form data:', Object.fromEntries(formData.entries()))
  
  try {
    switch (intent) {
      case 'add-contact': {
        const groupId = formData.get('groupId') as string
        const content = JSON.parse(formData.get('content') as string)
        const blendMode = formData.get('blendMode') as 'accept-last' | 'merge'
        const position = formData.get('position') ? JSON.parse(formData.get('position') as string) : undefined
        
        console.log('Adding contact to group:', groupId, { content, blendMode })
        
        const contactId = await client.addContact(groupId, {
          content,
          blendMode,
          groupId
        })
        
        console.log('Contact added successfully:', contactId)
        
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
      
      case 'delete-contact': {
        const contactId = formData.get('contactId') as string
        
        await client.removeContact(contactId)
        
        return { 
          success: true, 
          message: 'Contact deleted successfully' 
        }
      }
      
      case 'create-wire': {
        const fromId = formData.get('fromId') as string
        const toId = formData.get('toId') as string
        const type = formData.get('type') as 'bidirectional' | 'directed'
        
        const wireId = await client.connect(fromId, toId, type)
        
        return { 
          success: true, 
          wireId,
          message: 'Connection created successfully' 
        }
      }
      
      case 'delete-wire': {
        const wireId = formData.get('wireId') as string
        
        await client.disconnect(wireId)
        
        return { 
          success: true, 
          message: 'Connection deleted successfully' 
        }
      }
      
      default:
        return { 
          success: false, 
          error: `Unknown intent: ${intent}` 
        }
    }
  } catch (error) {
    console.error('Demo action error:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    }
  }
}