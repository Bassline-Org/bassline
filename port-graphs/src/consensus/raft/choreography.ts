/**
 * Raft Consensus Choreography
 *
 * Orchestrates multiple Raft nodes for leader election and consensus
 */

import { createGadget } from '../../core';
import { changed, noop } from '../../effects';
import { raftNode } from './raft-node';
import { RaftMessage, RaftEffect } from './types';

export interface RaftChoreographyState {
  nodes: Record<string, any>; // Raft node gadgets
  nodeIds: string[];
  network: Record<string, string[]>; // nodeId -> connected peers
  partitions: string[][]; // Network partitions for fault testing
  messageQueue: Array<{
    from: string;
    to: string;
    message: RaftMessage;
    delay?: number;
  }>;
  timers: Record<string, NodeJS.Timeout>;
  metrics: {
    messagesExchanged: number;
    electionsStarted: number;
    leadersElected: number;
  };
}

export interface ChoreographyCommand {
  type: 'addNode' | 'removeNode' | 'partition' | 'heal' | 'clientRequest' | 'tick';
  nodeId?: string;
  peers?: string[];
  partitions?: string[][];
  command?: any;
  target?: string;
}

export function raftChoreography(initialNodes: string[] = []): any {
  const initialState: RaftChoreographyState = {
    nodes: {},
    nodeIds: [],
    network: {},
    partitions: [],
    messageQueue: [],
    timers: {},
    metrics: {
      messagesExchanged: 0,
      electionsStarted: 0,
      leadersElected: 0
    }
  };

  // Initialize nodes if provided
  initialNodes.forEach(nodeId => {
    const peers = initialNodes.filter(id => id !== nodeId);
    initialState.nodes[nodeId] = createRaftNode(nodeId, peers);
    initialState.nodeIds.push(nodeId);
    initialState.network[nodeId] = peers;
  });

  return createGadget(
    (state: RaftChoreographyState, command: ChoreographyCommand) => {
      switch (command.type) {
        case 'addNode':
          return 'addNode';
        case 'removeNode':
          return 'removeNode';
        case 'partition':
          return 'partition';
        case 'heal':
          return 'heal';
        case 'clientRequest':
          return 'clientRequest';
        case 'tick':
          return 'tick';
        default:
          return 'ignore';
      }
    },
    {
      'addNode': (gadget, state, command: ChoreographyCommand) => {
        const { nodeId, peers = [] } = command;
        if (!nodeId || state.nodes[nodeId]) {
          return noop();
        }

        // Create new node
        const allPeers = [...state.nodeIds, ...peers].filter(id => id !== nodeId);
        const newNode = createRaftNode(nodeId, allPeers);

        // Update existing nodes' peer lists
        const updatedNodes = { ...state.nodes };
        state.nodeIds.forEach(existingId => {
          const existingNode = updatedNodes[existingId];
          if (existingNode) {
            // Add new node to peer list
            const updatedPeers = [...existingNode.current().peers, nodeId];
            existingNode.update({
              ...existingNode.current(),
              peers: updatedPeers
            });
          }
        });

        return changed({
          ...state,
          nodes: {
            ...updatedNodes,
            [nodeId]: newNode
          },
          nodeIds: [...state.nodeIds, nodeId],
          network: {
            ...state.network,
            [nodeId]: allPeers,
            // Update existing nodes' networks
            ...Object.fromEntries(
              state.nodeIds.map(id => [id, [...(state.network[id] || []), nodeId]])
            )
          }
        });
      },

      'removeNode': (gadget, state, command: ChoreographyCommand) => {
        const { nodeId } = command;
        if (!nodeId || !state.nodes[nodeId]) {
          return noop();
        }

        // Clear timers
        if (state.timers[nodeId]) {
          clearInterval(state.timers[nodeId]);
        }

        // Remove from all data structures
        const { [nodeId]: removedNode, ...remainingNodes } = state.nodes;
        const { [nodeId]: removedNetwork, ...remainingNetwork } = state.network;
        const { [nodeId]: removedTimer, ...remainingTimers } = state.timers;

        // Update remaining nodes' peer lists
        Object.values(remainingNodes).forEach(node => {
          const currentState = node.current();
          node.update({
            ...currentState,
            peers: currentState.peers.filter((id: string) => id !== nodeId)
          });
        });

        return changed({
          ...state,
          nodes: remainingNodes,
          nodeIds: state.nodeIds.filter(id => id !== nodeId),
          network: Object.fromEntries(
            Object.entries(remainingNetwork).map(([id, peers]) => [
              id,
              peers.filter(peerId => peerId !== nodeId)
            ])
          ),
          timers: remainingTimers
        });
      },

      'partition': (gadget, state, command: ChoreographyCommand) => {
        const { partitions = [] } = command;

        // Update network connectivity based on partitions
        const newNetwork: Record<string, string[]> = {};

        state.nodeIds.forEach(nodeId => {
          const partition = partitions.find(p => p.includes(nodeId));
          if (partition) {
            newNetwork[nodeId] = partition.filter(id => id !== nodeId);
          } else {
            newNetwork[nodeId] = []; // Isolated node
          }
        });

        return changed({
          ...state,
          network: newNetwork,
          partitions
        });
      },

      'heal': (gadget, state, command: ChoreographyCommand) => {
        // Restore full network connectivity
        const healedNetwork: Record<string, string[]> = {};
        state.nodeIds.forEach(nodeId => {
          healedNetwork[nodeId] = state.nodeIds.filter(id => id !== nodeId);
        });

        return changed({
          ...state,
          network: healedNetwork,
          partitions: []
        });
      },

      'clientRequest': (gadget, state, command: ChoreographyCommand) => {
        const { target, command: clientCommand } = command;

        // Find current leader or use specified target
        let targetNode = target;
        if (!targetNode) {
          // Find leader
          const leader = state.nodeIds.find(nodeId => {
            const node = state.nodes[nodeId];
            return node?.current()?.state === 'leader';
          });
          targetNode = leader;
        }

        if (targetNode && state.nodes[targetNode]) {
          state.nodes[targetNode].receive({
            type: 'ClientRequest',
            command: clientCommand
          });
        }

        return noop();
      },

      'tick': (gadget, state, command: ChoreographyCommand) => {
        const now = Date.now();
        const effects: any[] = [];

        // Process each node's timers
        state.nodeIds.forEach(nodeId => {
          const node = state.nodes[nodeId];
          if (!node) return;

          const nodeState = node.current();
          const timeSinceHeartbeat = now - nodeState.lastHeartbeat;

          if (nodeState.state === 'leader') {
            // Send heartbeats every 50ms
            if (timeSinceHeartbeat > 50) {
              node.receive({ type: 'Heartbeat' });
              // Update lastHeartbeat
              node.update({
                ...nodeState,
                lastHeartbeat: now
              });
            }
          } else if (timeSinceHeartbeat > nodeState.electionTimeout) {
            // Start election
            node.receive({ type: 'ElectionTimeout' });
            effects.push({
              electionStarted: { nodeId, term: nodeState.currentTerm + 1 }
            });
          }
        });

        // Process message queue with delays
        const remainingMessages = [];
        for (const msg of state.messageQueue) {
          const shouldDeliver = !msg.delay || msg.delay <= 0;
          if (shouldDeliver && state.nodes[msg.to] && canReach(state, msg.from, msg.to)) {
            state.nodes[msg.to].receive(msg.message);
            effects.push({
              messageDelivered: { from: msg.from, to: msg.to, type: msg.message.type }
            });
          } else {
            // Keep message, decrement delay
            remainingMessages.push({
              ...msg,
              delay: msg.delay ? Math.max(0, msg.delay - 10) : 0
            });
          }
        }

        return changed({
          ...state,
          messageQueue: remainingMessages,
          metrics: {
            ...state.metrics,
            messagesExchanged: state.metrics.messagesExchanged + (state.messageQueue.length - remainingMessages.length)
          },
          effects: effects.length > 0 ? effects : undefined
        });
      },

      'ignore': () => noop()
    }
  )(initialState);
}

// Helper function to create a Raft node with message routing
function createRaftNode(nodeId: string, peers: string[]): any {
  const node = raftNode(nodeId, peers);

  // Intercept emit to route messages through choreography
  const originalEmit = node.emit;
  node.emit = (effect: any) => {
    // Route Raft messages to appropriate nodes
    if (effect?.type && ['RequestVote', 'RequestVoteResponse', 'AppendEntries', 'AppendEntriesResponse'].includes(effect.type)) {
      // This will be handled by the choreography's message routing
      originalEmit({
        routeMessage: {
          from: nodeId,
          message: effect
        }
      });
    } else {
      originalEmit(effect);
    }
  };

  return node;
}

// Helper to check if two nodes can communicate given current network topology
function canReach(state: RaftChoreographyState, from: string, to: string): boolean {
  return state.network[from]?.includes(to) || false;
}

// Utility to start election timers
export function startRaftTimers(choreography: any): void {
  setInterval(() => {
    choreography.receive({ type: 'tick' });
  }, 10); // 10ms ticks
}

// Utility to create a cluster
export function createRaftCluster(nodeIds: string[]): any {
  const cluster = raftChoreography(nodeIds);

  // Wire up message routing
  cluster.emit = (effect: any) => {
    if (effect?.routeMessage) {
      const { from, message } = effect.routeMessage;

      // Broadcast or unicast based on message type
      if (message.type === 'RequestVote') {
        // Broadcast to all peers
        const currentState = cluster.current();
        const peers = currentState.network[from] || [];
        peers.forEach(peerId => {
          if (currentState.nodes[peerId]) {
            cluster.receive({
              type: 'routeMessage',
              from,
              to: peerId,
              message
            });
          }
        });
      } else if (message.from) {
        // Unicast response
        cluster.receive({
          type: 'routeMessage',
          from,
          to: message.from,
          message
        });
      }
    }
  };

  startRaftTimers(cluster);
  return cluster;
}