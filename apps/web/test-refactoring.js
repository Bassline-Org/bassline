// Test script for refactoring operations
// Run in browser console while on /editor-v2 route

async function testRefactoring() {
  const client = window.getNetworkClient?.();
  if (!client) {
    console.error('Network client not available');
    return;
  }

  console.log('Testing refactoring operations...');
  
  // Get current state
  const rootState = await client.getState('root');
  console.log('Root state:', rootState);
  
  // Create some test contacts
  const contact1 = await client.addContact('root', {
    content: 'Test Contact 1',
    blendMode: 'accept-last'
  });
  
  const contact2 = await client.addContact('root', {
    content: 'Test Contact 2',
    blendMode: 'accept-last'
  });
  
  console.log('Created contacts:', contact1, contact2);
  
  // Test extract-to-group
  console.log('Testing extract-to-group...');
  try {
    const extractResult = await client.applyRefactoring('extract-to-group', {
      contactIds: [contact1, contact2],
      groupName: 'Extracted Group',
      parentGroupId: 'root'
    });
    console.log('Extract result:', extractResult);
  } catch (error) {
    console.error('Extract failed:', error);
  }
  
  // Get updated state
  const updatedState = await client.getState('root');
  console.log('Updated state after extract:', updatedState);
}

// Run the test
testRefactoring();