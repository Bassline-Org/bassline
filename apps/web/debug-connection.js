// Debug script to test connection issues
// Run this in browser console on the editor page

async function debugConnection() {
  console.log('=== Connection Debug Test ===')
  
  try {
    const client = window.getNetworkClient()
    
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
    const addGadgetId = await client.addGroup('root', {
      name: 'Test Add',
      primitiveId: 'add'
    })
    console.log('   Add gadget created:', addGadgetId)
    
    // 3. Get the gadget state to see boundary contacts
    console.log('3. Getting gadget state...')
    const gadgetState = await client.getState(addGadgetId)
    console.log('   Gadget state:', gadgetState)
    console.log('   Boundary contacts:', Array.from(gadgetState.contacts.values()).filter(c => c.isBoundary))
    
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

console.log('Run debugConnection() to test connection issues')