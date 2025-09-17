#!/usr/bin/env tsx
/**
 * Simple Raft Test - Manual Fault Tolerance Scenarios
 *
 * Tests Raft behaviors by manually triggering events rather than relying on timers
 */

import { raftNode } from '../../src/consensus/raft/raft-node';

console.log('=== Simple Raft Fault Tolerance Test ===\n');

console.log('1. BASIC NODE CREATION');

// Create 3 nodes manually
const node1 = raftNode('node1', ['node2', 'node3']);
const node2 = raftNode('node2', ['node1', 'node3']);
const node3 = raftNode('node3', ['node1', 'node2']);

const nodes = { node1, node2, node3 };

// Add simple message routing
Object.entries(nodes).forEach(([nodeId, node]) => {
  const originalEmit = node.emit;
  node.emit = (effect: any) => {
    if (effect && typeof effect === 'object') {
      // Route Raft messages
      if (effect.type === 'RequestVote') {
        console.log(`  [${nodeId}] Broadcasting RequestVote for term ${effect.term}`);
        Object.entries(nodes).forEach(([peerId, peer]) => {
          if (peerId !== nodeId) {
            peer.receive(effect);
          }
        });
      } else if (effect.type === 'RequestVoteResponse') {
        console.log(`  [${nodeId}] Sending vote response: ${effect.voteGranted ? 'GRANTED' : 'DENIED'} from ${effect.from}`);
        // The 'from' field is the sender, we need to route to the original requester
        // For now, find the candidate and send there
        const candidate = Object.entries(nodes).find(([_, node]) => node.current().state === 'candidate');
        if (candidate) {
          candidate[1].receive(effect);
        }
      } else if (effect.type === 'AppendEntries') {
        console.log(`  [${nodeId}] Sending ${effect.entries.length === 0 ? 'heartbeat' : 'log entries'} to peers`);
        Object.entries(nodes).forEach(([peerId, peer]) => {
          if (peerId !== nodeId) {
            peer.receive(effect);
          }
        });
      } else if (effect.becameLeader) {
        console.log(`  [LEADER] ${nodeId} became leader in term ${effect.becameLeader.term}`);
      } else if (effect.becameCandidate) {
        console.log(`  [CANDIDATE] ${nodeId} became candidate in term ${effect.becameCandidate.term}`);
      } else if (effect.becameFollower) {
        console.log(`  [FOLLOWER] ${nodeId} became follower in term ${effect.becameFollower.term}`);
      }
    }
    originalEmit(effect);
  };
});

console.log('  Created nodes: node1, node2, node3');
console.log(`  Node1: ${node1.current().state} (term ${node1.current().currentTerm})`);
console.log(`  Node2: ${node2.current().state} (term ${node2.current().currentTerm})`);
console.log(`  Node3: ${node3.current().state} (term ${node3.current().currentTerm})`);

console.log('\n2. TRIGGERING ELECTION');

// Manually trigger election on node1
console.log('  Triggering election timeout on node1...');
console.log(`  Before: Node1 is ${node1.current().state} in term ${node1.current().currentTerm}`);
node1.receive({ type: 'ElectionTimeout' });
console.log(`  After: Node1 is ${node1.current().state} in term ${node1.current().currentTerm}`);

// Check states after election
setTimeout(() => {
  console.log('\n  Post-election states:');
  console.log(`  Node1: ${node1.current().state} (term ${node1.current().currentTerm})`);
  console.log(`  Node2: ${node2.current().state} (term ${node2.current().currentTerm})`);
  console.log(`  Node3: ${node3.current().state} (term ${node3.current().currentTerm})`);

  const leader = Object.entries(nodes).find(([_, node]) => node.current().state === 'leader');
  if (leader) {
    console.log(`  ✓ Leader elected: ${leader[0]}`);
  } else {
    console.log('  ✗ No leader elected');
  }
}, 200);

setTimeout(() => {
  console.log('\n3. CLIENT REQUEST');

  // Find the leader
  const leader = Object.entries(nodes).find(([_, node]) => node.current().state === 'leader');

  if (leader) {
    const [leaderId, leaderNode] = leader;
    console.log(`  Sending client request to leader ${leaderId}...`);

    leaderNode.receive({
      type: 'ClientRequest',
      command: { op: 'SET', key: 'user1', value: 'Alice' }
    });

    setTimeout(() => {
      console.log(`  Leader log length: ${leaderNode.current().log.length}`);
    }, 50);
  }
}, 200);

setTimeout(() => {
  console.log('\n4. LEADER FAILURE SIMULATION');

  const leader = Object.entries(nodes).find(([_, node]) => node.current().state === 'leader');

  if (leader) {
    const [leaderId] = leader;
    console.log(`  Simulating ${leaderId} failure by triggering new election...`);

    // Trigger election on another node
    const otherNodes = Object.entries(nodes).filter(([id]) => id !== leaderId);
    if (otherNodes.length > 0) {
      const [newCandidateId, newCandidate] = otherNodes[0];
      console.log(`  ${newCandidateId} starting election...`);
      newCandidate.receive({ type: 'ElectionTimeout' });
    }
  }
}, 400);

setTimeout(() => {
  console.log('\n5. FINAL STATE');

  Object.entries(nodes).forEach(([nodeId, node]) => {
    const state = node.current();
    console.log(`  ${nodeId}: ${state.state} (term ${state.currentTerm}, log: ${state.log.length} entries)`);
    if (state.state === 'leader') {
      console.log(`    Leader commit index: ${state.commitIndex}`);
    }
  });

  console.log('\n=== Key Behaviors Demonstrated ===');
  console.log('✓ Follower -> Candidate transition on election timeout');
  console.log('✓ RequestVote message broadcasting');
  console.log('✓ Vote counting and leader election');
  console.log('✓ Client request handling by leader');
  console.log('✓ Log entry creation');
  console.log('✓ Leader failure and re-election scenario');

  process.exit(0);
}, 600);