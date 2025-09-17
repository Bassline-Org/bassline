/**
 * Raft Log Replication Protocol
 *
 * Implements the log replication aspect of Raft consensus
 */

import { createGadget } from '../../core';
import { changed, noop } from '../../effects';
import { LogEntry, AppendEntries, AppendEntriesResponse } from './types';

export interface LogReplicationState {
  leaderId: string;
  term: number;
  log: LogEntry[];
  commitIndex: number;

  // Per-follower state (leader only)
  nextIndex: Record<string, number>;
  matchIndex: Record<string, number>;

  // Replication tracking
  pendingEntries: Record<string, LogEntry[]>; // nodeId -> pending entries
  replicationStatus: Record<string, 'synced' | 'lagging' | 'failed'>;

  // Metrics
  metrics: {
    entriesReplicated: number;
    replicationRounds: number;
    conflictsResolved: number;
  };
}

export interface ReplicationCommand {
  type: 'appendEntry' | 'replicateToFollower' | 'processResponse' | 'heartbeat';
  entry?: LogEntry;
  followerId?: string;
  response?: AppendEntriesResponse;
  followers?: string[];
}

export function logReplicationProtocol(
  leaderId: string,
  followers: string[],
  initialTerm: number = 0
): any {
  const initialState: LogReplicationState = {
    leaderId,
    term: initialTerm,
    log: [],
    commitIndex: -1,
    nextIndex: Object.fromEntries(followers.map(id => [id, 0])),
    matchIndex: Object.fromEntries(followers.map(id => [id, -1])),
    pendingEntries: {},
    replicationStatus: Object.fromEntries(followers.map(id => [id, 'synced'])),
    metrics: {
      entriesReplicated: 0,
      replicationRounds: 0,
      conflictsResolved: 0
    }
  };

  return createGadget(
    (state: LogReplicationState, command: ReplicationCommand) => {
      switch (command.type) {
        case 'appendEntry':
          return 'appendEntry';
        case 'replicateToFollower':
          return 'replicateToFollower';
        case 'processResponse':
          return 'processResponse';
        case 'heartbeat':
          return 'heartbeat';
        default:
          return 'ignore';
      }
    },
    {
      'appendEntry': (gadget, state, command: ReplicationCommand) => {
        const { entry } = command;
        if (!entry) return noop();

        // Add entry to log
        const newLog = [...state.log, entry];

        // Start replication to all followers
        const replicationMessages = Object.keys(state.nextIndex).map(followerId => {
          const nextIndex = state.nextIndex[followerId];
          const prevLogIndex = nextIndex - 1;
          const prevLogTerm = state.log[prevLogIndex]?.term || 0;

          return {
            type: 'AppendEntries' as const,
            term: state.term,
            leaderId: state.leaderId,
            prevLogIndex,
            prevLogTerm,
            entries: newLog.slice(nextIndex),
            leaderCommit: state.commitIndex
          };
        });

        return changed({
          ...state,
          log: newLog,
          metrics: {
            ...state.metrics,
            replicationRounds: state.metrics.replicationRounds + 1
          },
          effects: [
            { logEntryAdded: { index: entry.index, entry } },
            ...replicationMessages
          ]
        });
      },

      'replicateToFollower': (gadget, state, command: ReplicationCommand) => {
        const { followerId } = command;
        if (!followerId || !(followerId in state.nextIndex)) {
          return noop();
        }

        const nextIndex = state.nextIndex[followerId];
        const prevLogIndex = nextIndex - 1;
        const prevLogTerm = state.log[prevLogIndex]?.term || 0;

        // Determine entries to send
        const entries = state.log.slice(nextIndex);

        const appendEntries: AppendEntries = {
          type: 'AppendEntries',
          term: state.term,
          leaderId: state.leaderId,
          prevLogIndex,
          prevLogTerm,
          entries,
          leaderCommit: state.commitIndex
        };

        return changed({
          ...state,
          replicationStatus: {
            ...state.replicationStatus,
            [followerId]: entries.length > 0 ? 'lagging' : 'synced'
          },
          effects: [appendEntries]
        });
      },

      'processResponse': (gadget, state, command: ReplicationCommand) => {
        const { response } = command;
        if (!response) return noop();

        const { from, success, matchIndex, term } = response;

        // Check if response is for current term
        if (term !== state.term) {
          return noop();
        }

        if (success) {
          // Update indices for successful replication
          const newMatchIndex = { ...state.matchIndex };
          const newNextIndex = { ...state.nextIndex };

          if (matchIndex !== undefined) {
            newMatchIndex[from] = matchIndex;
            newNextIndex[from] = matchIndex + 1;
          }

          // Check if we can advance commit index
          const matchValues = Object.values(newMatchIndex);
          matchValues.sort((a, b) => b - a); // Sort descending
          const majorityIndex = Math.floor(matchValues.length / 2);
          const newCommitIndex = Math.max(state.commitIndex, matchValues[majorityIndex] || -1);

          // Generate commit effects
          const commitEffects = [];
          for (let i = state.commitIndex + 1; i <= newCommitIndex; i++) {
            if (state.log[i]) {
              commitEffects.push({
                logCommitted: { index: i, entry: state.log[i] }
              });
            }
          }

          return changed({
            ...state,
            matchIndex: newMatchIndex,
            nextIndex: newNextIndex,
            commitIndex: newCommitIndex,
            replicationStatus: {
              ...state.replicationStatus,
              [from]: 'synced'
            },
            metrics: {
              ...state.metrics,
              entriesReplicated: state.metrics.entriesReplicated +
                (matchIndex !== undefined ? matchIndex - state.matchIndex[from] : 0)
            },
            effects: [
              { replicationSuccess: { follower: from, matchIndex } },
              ...commitEffects
            ]
          });
        } else {
          // Replication failed - decrement nextIndex and retry
          const currentNextIndex = state.nextIndex[from] || 0;
          const newNextIndex = {
            ...state.nextIndex,
            [from]: Math.max(0, currentNextIndex - 1)
          };

          return changed({
            ...state,
            nextIndex: newNextIndex,
            replicationStatus: {
              ...state.replicationStatus,
              [from]: 'failed'
            },
            metrics: {
              ...state.metrics,
              conflictsResolved: state.metrics.conflictsResolved + 1
            },
            effects: [
              { replicationConflict: { follower: from, newNextIndex: newNextIndex[from] } },
              // Retry with new nextIndex
              {
                type: 'replicateToFollower',
                followerId: from
              }
            ]
          });
        }
      },

      'heartbeat': (gadget, state, command: ReplicationCommand) => {
        const { followers = Object.keys(state.nextIndex) } = command;

        // Send empty AppendEntries (heartbeat) to all followers
        const heartbeats = followers.map(followerId => {
          const nextIndex = state.nextIndex[followerId] || 0;
          const prevLogIndex = nextIndex - 1;
          const prevLogTerm = state.log[prevLogIndex]?.term || 0;

          return {
            type: 'AppendEntries' as const,
            term: state.term,
            leaderId: state.leaderId,
            prevLogIndex,
            prevLogTerm,
            entries: [], // Empty for heartbeat
            leaderCommit: state.commitIndex
          };
        });

        return changed({
          ...state,
          effects: [
            { heartbeatSent: { to: followers } },
            ...heartbeats
          ]
        });
      },

      'ignore': () => noop()
    }
  )(initialState);
}

// Utility to create a replication manager that handles batch operations
export function batchLogReplication(
  leaderId: string,
  followers: string[],
  batchSize: number = 10
): any {
  const protocol = logReplicationProtocol(leaderId, followers);
  const entryQueue: LogEntry[] = [];
  let batchTimer: NodeJS.Timeout | null = null;

  // Override receive to batch entries
  const originalReceive = protocol.receive;
  protocol.receive = (command: ReplicationCommand) => {
    if (command.type === 'appendEntry' && command.entry) {
      entryQueue.push(command.entry);

      // Start batch timer if not already running
      if (!batchTimer) {
        batchTimer = setTimeout(() => {
          if (entryQueue.length > 0) {
            // Send batch
            const batch = entryQueue.splice(0, batchSize);
            batch.forEach(entry => {
              originalReceive({ type: 'appendEntry', entry });
            });
          }
          batchTimer = null;
        }, 10); // 10ms batch window
      }

      // Send immediately if batch is full
      if (entryQueue.length >= batchSize) {
        if (batchTimer) {
          clearTimeout(batchTimer);
          batchTimer = null;
        }
        const batch = entryQueue.splice(0, batchSize);
        batch.forEach(entry => {
          originalReceive({ type: 'appendEntry', entry });
        });
      }
    } else {
      originalReceive(command);
    }
  };

  return protocol;
}

// Utility for log compaction/snapshotting
export interface SnapshotState {
  lastIncludedIndex: number;
  lastIncludedTerm: number;
  snapshot: any; // Application-specific snapshot data
}

export function createLogSnapshot(
  log: LogEntry[],
  commitIndex: number,
  applicationState: any
): SnapshotState {
  return {
    lastIncludedIndex: commitIndex,
    lastIncludedTerm: log[commitIndex]?.term || 0,
    snapshot: applicationState
  };
}

export function compactLog(
  log: LogEntry[],
  snapshot: SnapshotState
): LogEntry[] {
  // Keep only entries after the snapshot
  return log.slice(snapshot.lastIncludedIndex + 1);
}