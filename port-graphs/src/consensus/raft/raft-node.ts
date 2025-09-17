/**
 * Raft Node State Machine
 *
 * Implements the core Raft consensus algorithm as a gadget
 */

import { createGadget } from '../../core';
import { changed, noop } from '../../effects';
import {
  RaftState,
  RaftMessage,
  NodeState,
  LogEntry,
  RequestVote,
  RequestVoteResponse,
  AppendEntries,
  AppendEntriesResponse,
  ClientRequest,
  RaftEffect
} from './types';

export function raftNode(
  nodeId: string,
  peers: string[],
  initialState?: Partial<RaftState>
): any {
  const initialRaftState: RaftState = {
    currentTerm: 0,
    votedFor: null,
    log: [],
    commitIndex: -1,
    lastApplied: -1,
    state: 'follower',
    nodeId,
    peers,
    lastHeartbeat: Date.now(),
    electionTimeout: 150 + Math.random() * 150, // 150-300ms
    ...initialState
  };

  return createGadget(
    (state: RaftState, message: RaftMessage | { type: 'ElectionTimeout' | 'Heartbeat' }) => {
      switch (message.type) {
        case 'RequestVote':
          return { action: 'handleRequestVote', context: message };
        case 'RequestVoteResponse':
          return { action: 'handleRequestVoteResponse', context: message };
        case 'AppendEntries':
          return { action: 'handleAppendEntries', context: message };
        case 'AppendEntriesResponse':
          return { action: 'handleAppendEntriesResponse', context: message };
        case 'ClientRequest':
          return { action: 'handleClientRequest', context: message };
        case 'ElectionTimeout':
          return { action: 'startElection', context: {} };
        case 'Heartbeat':
          return { action: 'sendHeartbeat', context: {} };
        default:
          return { action: 'ignore', context: {} };
      }
    },
    {
      'handleRequestVote': (gadget, message: RequestVote) => {
        const state = gadget.current();
        const { term, candidateId, lastLogIndex, lastLogTerm } = message;

        // Reply false if term < currentTerm
        if (term < state.currentTerm) {
          return changed({
            ...state,
            effects: [{
              type: 'RequestVoteResponse',
              term: state.currentTerm,
              voteGranted: false,
              from: state.nodeId
            }]
          });
        }

        // If term > currentTerm, become follower
        let currentState = state;
        if (term > state.currentTerm) {
          currentState = {
            ...state,
            currentTerm: term,
            votedFor: null,
            state: 'follower'
          };
          gadget.update(currentState);
        }

        // Vote for candidate if we haven't voted or voted for this candidate
        const canVote = currentState.votedFor === null || currentState.votedFor === candidateId;
        const logUpToDate = isLogUpToDate(currentState.log, lastLogIndex, lastLogTerm);

        if (canVote && logUpToDate) {
          const newState = {
            ...currentState,
            votedFor: candidateId,
            lastHeartbeat: Date.now()
          };
          gadget.update(newState);

          gadget.emit({
            type: 'RequestVoteResponse',
            term: currentState.currentTerm,
            voteGranted: true,
            from: currentState.nodeId
          });

          gadget.emit({
            voteGranted: { from: currentState.nodeId, to: candidateId, term: currentState.currentTerm }
          });

          return changed(newState);
        } else {
          gadget.emit({
            type: 'RequestVoteResponse',
            term: currentState.currentTerm,
            voteGranted: false,
            from: currentState.nodeId
          });

          return changed(currentState);
        }
      },

      'handleRequestVoteResponse': (gadget, message: RequestVoteResponse) => {
        const state = gadget.current();
        const { term, voteGranted, from } = message;

        // Ignore if not a candidate or old term
        if (state.state !== 'candidate' || term !== state.currentTerm) {
          return noop();
        }

        if (voteGranted) {
          // Add vote to received votes
          const votesReceived = [...(state.votesReceived || [])];
          if (!votesReceived.includes(from)) {
            votesReceived.push(from);
          }

          // Count votes (including our own)
          const voteCount = 1 + votesReceived.length;
          const majority = Math.floor((state.peers.length + 1) / 2) + 1; // +1 for ourselves

          if (voteCount >= majority) {
            // Become leader
            const nextIndex: Record<string, number> = {};
            const matchIndex: Record<string, number> = {};

            state.peers.forEach(peer => {
              nextIndex[peer] = state.log.length;
              matchIndex[peer] = -1;
            });

            const newState = {
              ...state,
              state: 'leader' as NodeState,
              nextIndex,
              matchIndex,
              votesReceived: undefined, // Clear votes
            };

            gadget.update(newState);

            gadget.emit({ becameLeader: { nodeId: state.nodeId, term: state.currentTerm } });
            gadget.emit({ electionWon: { nodeId: state.nodeId, term: state.currentTerm, votes: voteCount } });

            return changed(newState);
          }

          const newState = {
            ...state,
            votesReceived
          };
          gadget.update(newState);

          return changed(newState);
        }

        return noop();
      },

      'handleAppendEntries': (gadget, state, message: AppendEntries) => {
        const { term, leaderId, prevLogIndex, prevLogTerm, entries, leaderCommit } = message;

        // Reply false if term < currentTerm
        if (term < state.currentTerm) {
          return changed({
            ...state,
            effects: [{
              type: 'AppendEntriesResponse',
              term: state.currentTerm,
              success: false,
              from: state.nodeId
            }]
          });
        }

        // Become follower if term >= currentTerm
        if (term >= state.currentTerm) {
          state = {
            ...state,
            currentTerm: term,
            state: 'follower',
            votedFor: null,
            lastHeartbeat: Date.now()
          };

          if (state.state !== 'follower') {
            state.effects = [
              ...(state.effects || []),
              { becameFollower: { nodeId: state.nodeId, term } }
            ];
          }
        }

        // Check log consistency
        if (prevLogIndex >= 0 &&
            (state.log.length <= prevLogIndex ||
             state.log[prevLogIndex]?.term !== prevLogTerm)) {
          return changed({
            ...state,
            effects: [{
              type: 'AppendEntriesResponse',
              term: state.currentTerm,
              success: false,
              from: state.nodeId
            }]
          });
        }

        // Append new entries
        let newLog = [...state.log];
        if (entries.length > 0) {
          // Delete conflicting entries and append new ones
          newLog = newLog.slice(0, prevLogIndex + 1);
          newLog.push(...entries);
        }

        // Update commit index
        const newCommitIndex = Math.min(leaderCommit, newLog.length - 1);
        const commitEffects: RaftEffect[] = [];

        for (let i = state.commitIndex + 1; i <= newCommitIndex; i++) {
          if (newLog[i]) {
            commitEffects.push({
              logCommitted: { index: i, entry: newLog[i] }
            });
          }
        }

        return changed({
          ...state,
          log: newLog,
          commitIndex: newCommitIndex,
          effects: [
            {
              type: 'AppendEntriesResponse',
              term: state.currentTerm,
              success: true,
              from: state.nodeId,
              matchIndex: newLog.length - 1
            },
            ...commitEffects
          ]
        });
      },

      'handleAppendEntriesResponse': (gadget, state, message: AppendEntriesResponse) => {
        const { term, success, from, matchIndex } = message;

        // Ignore if not leader or old term
        if (state.state !== 'leader' || term !== state.currentTerm) {
          return noop();
        }

        if (success && matchIndex !== undefined) {
          // Update match and next indices
          const newMatchIndex = { ...state.matchIndex, [from]: matchIndex };
          const newNextIndex = { ...state.nextIndex, [from]: matchIndex + 1 };

          // Check if we can advance commit index
          const sortedMatches = Object.values(newMatchIndex).sort((a, b) => b - a);
          const majorityIndex = Math.floor(state.peers.length / 2);
          const newCommitIndex = Math.max(state.commitIndex, sortedMatches[majorityIndex] || -1);

          const commitEffects: RaftEffect[] = [];
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
            effects: commitEffects
          });
        } else {
          // Decrement nextIndex and retry
          const newNextIndex = {
            ...state.nextIndex,
            [from]: Math.max(0, (state.nextIndex?.[from] || 0) - 1)
          };

          return changed({
            ...state,
            nextIndex: newNextIndex
          });
        }
      },

      'handleClientRequest': (gadget, state, message: ClientRequest) => {
        // Only leaders can handle client requests
        if (state.state !== 'leader') {
          return noop();
        }

        const newEntry: LogEntry = {
          term: state.currentTerm,
          index: state.log.length,
          command: message.command
        };

        return changed({
          ...state,
          log: [...state.log, newEntry]
        });
      },

      'ignore': () => noop(),

      // Periodic actions
      'startElection': (gadget, context) => {
        const state = gadget.current();
        if (state.state === 'leader') return noop();

        const newTerm = state.currentTerm + 1;
        const lastLogIndex = state.log.length - 1;
        const lastLogTerm = state.log[lastLogIndex]?.term || 0;

        const newState = {
          ...state,
          currentTerm: newTerm,
          state: 'candidate' as NodeState,
          votedFor: state.nodeId,
          votesReceived: [], // Initialize empty vote tracking
          lastHeartbeat: Date.now()
        };

        // Update the gadget's state
        gadget.update(newState);

        // Emit effects
        gadget.emit({ becameCandidate: { nodeId: state.nodeId, term: newTerm } });
        gadget.emit({ electionStarted: { nodeId: state.nodeId, term: newTerm } });

        // Send RequestVote to all peers
        state.peers.forEach(peer => {
          gadget.emit({
            type: 'RequestVote' as const,
            term: newTerm,
            candidateId: state.nodeId,
            lastLogIndex,
            lastLogTerm
          });
        });

        return changed(newState);
      },

      'sendHeartbeat': (gadget, state) => {
        if (state.state !== 'leader') return noop();

        const heartbeats = state.peers.map(peer => {
          const nextIndex = state.nextIndex?.[peer] || 0;
          const prevLogIndex = nextIndex - 1;
          const prevLogTerm = state.log[prevLogIndex]?.term || 0;

          return {
            type: 'AppendEntries' as const,
            term: state.currentTerm,
            leaderId: state.nodeId,
            prevLogIndex,
            prevLogTerm,
            entries: [], // Empty for heartbeat
            leaderCommit: state.commitIndex
          };
        });

        return changed({
          ...state,
          effects: [
            { heartbeatSent: { from: state.nodeId, to: state.peers } },
            ...heartbeats
          ]
        });
      }
    }
  )(initialRaftState);
}

// Helper functions
function isLogUpToDate(log: LogEntry[], lastLogIndex: number, lastLogTerm: number): boolean {
  const ourLastIndex = log.length - 1;
  const ourLastTerm = log[ourLastIndex]?.term || 0;

  // Candidate's log is up-to-date if it has higher term in last entry,
  // or same term but at least as long
  return lastLogTerm > ourLastTerm ||
         (lastLogTerm === ourLastTerm && lastLogIndex >= ourLastIndex);
}

