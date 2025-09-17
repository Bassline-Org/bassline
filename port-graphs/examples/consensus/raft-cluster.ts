#!/usr/bin/env tsx
/**
 * Multi-Node Raft Consensus Example
 *
 * Demonstrates Raft consensus with leader election, log replication,
 * and fault tolerance scenarios
 */

import { createRaftCluster } from '../../src/consensus/raft/choreography';
import { logReplicationProtocol } from '../../src/consensus/raft/log-replication';

console.log('=== Multi-Node Raft Consensus Example ===\n');

console.log('1. CREATING RAFT CLUSTER');

// Create a 5-node cluster
const nodeIds = ['node1', 'node2', 'node3', 'node4', 'node5'];
const cluster = createRaftCluster(nodeIds);

// Monitor cluster events
let currentLeader: string | null = null;
let electionCount = 0;
let commitCount = 0;

cluster.emit = (effect: any) => {
  if (effect?.becameLeader) {
    currentLeader = effect.becameLeader.nodeId;
    console.log(`  [LEADER ELECTED] ${currentLeader} in term ${effect.becameLeader.term}`);
  } else if (effect?.electionStarted) {
    electionCount++;
    console.log(`  [ELECTION ${electionCount}] Started by ${effect.electionStarted.nodeId}`);
  } else if (effect?.logCommitted) {
    commitCount++;
    console.log(`  [COMMIT ${commitCount}] Index ${effect.logCommitted.index}: ${JSON.stringify(effect.logCommitted.entry.command)}`);
  } else if (effect?.messageDelivered) {
    // Uncomment for detailed message tracking
    // console.log(`  [MSG] ${effect.messageDelivered.from} -> ${effect.messageDelivered.to}: ${effect.messageDelivered.type}`);
  } else {
    console.log(`  [CLUSTER]`, JSON.stringify(effect, null, 2));
  }
};

console.log(`  Created cluster with nodes: ${nodeIds.join(', ')}\n`);

// Wait for initial leader election
setTimeout(() => {
  console.log('2. SUBMITTING CLIENT REQUESTS');

  if (currentLeader) {
    console.log(`  Submitting requests to leader: ${currentLeader}`);

    // Submit some client requests
    setTimeout(() => {
      cluster.receive({
        type: 'clientRequest',
        target: currentLeader,
        command: { type: 'PUT', key: 'user1', value: 'Alice' }
      });
    }, 100);

    setTimeout(() => {
      cluster.receive({
        type: 'clientRequest',
        target: currentLeader,
        command: { type: 'PUT', key: 'user2', value: 'Bob' }
      });
    }, 200);

    setTimeout(() => {
      cluster.receive({
        type: 'clientRequest',
        target: currentLeader,
        command: { type: 'GET', key: 'user1' }
      });
    }, 300);
  } else {
    console.log('  No leader elected yet, waiting...');
  }
}, 1000);

// Test network partition scenario
setTimeout(() => {
  console.log('\n3. NETWORK PARTITION SCENARIO');
  console.log('  Partitioning network: [node1, node2] | [node3, node4, node5]');

  cluster.receive({
    type: 'partition',
    partitions: [
      ['node1', 'node2'],
      ['node3', 'node4', 'node5']
    ]
  });

  // Try to send requests to both partitions
  setTimeout(() => {
    console.log('  Sending request to minority partition...');
    cluster.receive({
      type: 'clientRequest',
      target: 'node1',
      command: { type: 'PUT', key: 'test', value: 'minority' }
    });
  }, 500);

  setTimeout(() => {
    console.log('  Sending request to majority partition...');
    cluster.receive({
      type: 'clientRequest',
      target: 'node3',
      command: { type: 'PUT', key: 'test', value: 'majority' }
    });
  }, 600);
}, 3000);

// Heal the partition
setTimeout(() => {
  console.log('\n4. HEALING NETWORK PARTITION');
  console.log('  Restoring full network connectivity...');

  cluster.receive({ type: 'heal' });

  // Allow some time for re-election and log reconciliation
}, 6000);

// Test node failure and recovery
setTimeout(() => {
  console.log('\n5. NODE FAILURE AND RECOVERY');

  const failedNode = 'node2';
  console.log(`  Removing node: ${failedNode}`);

  cluster.receive({
    type: 'removeNode',
    nodeId: failedNode
  });

  // Add it back later
  setTimeout(() => {
    console.log(`  Adding node back: ${failedNode}`);
    cluster.receive({
      type: 'addNode',
      nodeId: failedNode,
      peers: nodeIds.filter(id => id !== failedNode)
    });
  }, 2000);
}, 8000);

// Final cluster state
setTimeout(() => {
  console.log('\n6. FINAL CLUSTER STATE');

  const state = cluster.current();
  console.log(`  Active nodes: ${state.nodeIds.length}`);
  console.log(`  Current leader: ${currentLeader || 'None'}`);
  console.log(`  Elections held: ${electionCount}`);
  console.log(`  Entries committed: ${commitCount}`);

  // Show each node's state
  console.log('\n  Node States:');
  state.nodeIds.forEach((nodeId: string) => {
    const node = state.nodes[nodeId];
    if (node) {
      const nodeState = node.current();
      console.log(`    ${nodeId}: ${nodeState.state} (term ${nodeState.currentTerm}, log: ${nodeState.log.length} entries)`);
    }
  });

  console.log('\n=== Raft Consensus Demo Complete ===');
  process.exit(0);
}, 12000);

// Create a separate log replication example
setTimeout(() => {
  console.log('\n7. LOG REPLICATION PROTOCOL DEMO');

  const replication = logReplicationProtocol('leader', ['follower1', 'follower2', 'follower3'], 1);

  // Monitor replication events
  replication.emit = (effect: any) => {
    if (effect?.logEntryAdded) {
      console.log(`  [REPLICATION] Added entry ${effect.logEntryAdded.index}`);
    } else if (effect?.replicationSuccess) {
      console.log(`  [REPLICATION] Success to ${effect.replicationSuccess.follower}`);
    } else if (effect?.replicationConflict) {
      console.log(`  [REPLICATION] Conflict with ${effect.replicationConflict.follower}, retrying...`);
    }
  };

  // Add some log entries
  replication.receive({
    type: 'appendEntry',
    entry: { term: 1, index: 0, command: { op: 'set', key: 'a', value: 1 } }
  });

  replication.receive({
    type: 'appendEntry',
    entry: { term: 1, index: 1, command: { op: 'set', key: 'b', value: 2 } }
  });

  // Simulate successful responses
  setTimeout(() => {
    replication.receive({
      type: 'processResponse',
      response: {
        type: 'AppendEntriesResponse',
        term: 1,
        success: true,
        from: 'follower1',
        matchIndex: 1
      }
    });
  }, 100);

  setTimeout(() => {
    replication.receive({
      type: 'processResponse',
      response: {
        type: 'AppendEntriesResponse',
        term: 1,
        success: true,
        from: 'follower2',
        matchIndex: 1
      }
    });
  }, 150);

  // Show final replication state
  setTimeout(() => {
    const replState = replication.current();
    console.log(`  Replication metrics: ${JSON.stringify(replState.metrics, null, 2)}`);
    console.log(`  Commit index: ${replState.commitIndex}`);
  }, 300);
}, 500);