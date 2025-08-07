// Quick test for refactoring - paste in browser console on /editor-v2

(async () => {
  const client = window.getNetworkClient?.();
  if (!client) {
    console.error('Go to /editor-v2 first');
    return;
  }
  
  console.log('Creating test setup...');
  
  // Create contacts
  const c1 = await client.addContact('root', { content: 'A', blendMode: 'accept-last' });
  const c2 = await client.addContact('root', { content: 'B', blendMode: 'accept-last' });
  
  // Wire them
  await client.connect(c1, c2, 'bidirectional');
  
  console.log('Extracting to group...');
  const result = await client.applyRefactoring('extract-to-group', {
    contactIds: [c1, c2],
    groupName: 'Test Group',
    parentGroupId: 'root'
  });
  
  console.log('Extract result:', result);
  
  // Get the new group
  const rootState = await client.getState('root');
  const newGroupId = rootState.group.subgroupIds[rootState.group.subgroupIds.length - 1];
  
  console.log('New group ID:', newGroupId);
  console.log('Root state after extract:', {
    contacts: Array.from(rootState.contacts.keys()),
    subgroups: rootState.group.subgroupIds
  });
  
  // Now inline it back
  console.log('Inlining group...');
  const inlineResult = await client.applyRefactoring('inline-group', {
    groupId: newGroupId
  });
  
  console.log('Inline result:', inlineResult);
  
  // Check final state
  const finalState = await client.getState('root');
  console.log('Final root state:', {
    contacts: Array.from(finalState.contacts.keys()),
    subgroups: finalState.group.subgroupIds
  });
})();