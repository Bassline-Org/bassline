// Debug script for refactoring operations
// Run in browser console while on /editor-v2 route

async function debugRefactoring() {
  const client = window.getNetworkClient?.();
  if (!client) {
    console.error('Network client not available. Make sure you are on /editor-v2 route.');
    return;
  }

  console.log('=== Testing Refactoring Operations ===');
  
  try {
    // Get initial state
    console.log('\n1. Getting initial root state...');
    const initialState = await client.getState('root');
    console.log('Initial contacts:', initialState.contacts.size);
    console.log('Initial subgroups:', initialState.group.subgroupIds);
    
    // Create test contacts
    console.log('\n2. Creating test contacts...');
    const contact1 = await client.addContact('root', {
      content: 'Test Contact A',
      blendMode: 'accept-last'
    });
    
    const contact2 = await client.addContact('root', {
      content: 'Test Contact B',
      blendMode: 'accept-last'
    });
    
    console.log('Created contacts:', [contact1, contact2]);
    
    // Connect them
    console.log('\n3. Creating wire between contacts...');
    const wireId = await client.connect(contact1, contact2, 'bidirectional');
    console.log('Created wire:', wireId);
    
    // Get state before extract
    console.log('\n4. State before extract-to-group...');
    const beforeExtract = await client.getState('root');
    console.log('Root contacts:', Array.from(beforeExtract.contacts.keys()));
    console.log('Root wires:', Array.from(beforeExtract.wires.keys()));
    console.log('Root subgroups:', beforeExtract.group.subgroupIds);
    
    // Extract to group
    console.log('\n5. Extracting contacts to group...');
    const extractResult = await client.applyRefactoring('extract-to-group', {
      contactIds: [contact1, contact2],
      groupName: 'Extracted Test Group',
      parentGroupId: 'root'
    });
    console.log('Extract result:', extractResult);
    
    // Get state after extract
    console.log('\n6. State after extract-to-group...');
    const afterExtract = await client.getState('root');
    console.log('Root contacts:', Array.from(afterExtract.contacts.keys()));
    console.log('Root wires:', Array.from(afterExtract.wires.keys()));
    console.log('Root subgroups:', afterExtract.group.subgroupIds);
    
    // Get the new group's state
    if (afterExtract.group.subgroupIds.length > 0) {
      const newGroupId = afterExtract.group.subgroupIds[afterExtract.group.subgroupIds.length - 1];
      console.log('\n7. Getting extracted group state...');
      const extractedGroupState = await client.getState(newGroupId);
      console.log('Extracted group:', extractedGroupState.group);
      console.log('Group contacts:', Array.from(extractedGroupState.contacts.keys()));
      console.log('Group wires:', Array.from(extractedGroupState.wires.keys()));
      
      // Now test inline
      console.log('\n8. Testing inline-group...');
      try {
        const inlineResult = await client.applyRefactoring('inline-group', {
          groupId: newGroupId
        });
        console.log('Inline result:', inlineResult);
        
        // Get final state
        console.log('\n9. State after inline-group...');
        const afterInline = await client.getState('root');
        console.log('Root contacts:', Array.from(afterInline.contacts.keys()));
        console.log('Root wires:', Array.from(afterInline.wires.keys()));
        console.log('Root subgroups:', afterInline.group.subgroupIds);
      } catch (inlineError) {
        console.error('Inline failed:', inlineError);
      }
    }
    
  } catch (error) {
    console.error('Debug failed:', error);
    console.error('Stack:', error.stack);
  }
}

// Run the debug
debugRefactoring();