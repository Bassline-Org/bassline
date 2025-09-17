/**
 * Raft consensus protocol types
 */

export type NodeState = 'follower' | 'candidate' | 'leader';

export interface RaftState {
  // Persistent state
  currentTerm: number;
  votedFor: string | null;
  log: LogEntry[];

  // Volatile state
  commitIndex: number;
  lastApplied: number;
  state: NodeState;

  // Leader state (reinitialized after election)
  nextIndex?: Record<string, number>;
  matchIndex?: Record<string, number>;

  // Node identity
  nodeId: string;
  peers: string[];

  // Timing
  lastHeartbeat: number;
  electionTimeout: number;

  // Vote tracking (for candidates)
  votesReceived?: string[];
}

export interface LogEntry {
  term: number;
  index: number;
  command: any;
}

// Raft RPC messages
export type RaftMessage =
  | RequestVote
  | RequestVoteResponse
  | AppendEntries
  | AppendEntriesResponse
  | ClientRequest;

export interface RequestVote {
  type: 'RequestVote';
  term: number;
  candidateId: string;
  lastLogIndex: number;
  lastLogTerm: number;
}

export interface RequestVoteResponse {
  type: 'RequestVoteResponse';
  term: number;
  voteGranted: boolean;
  from: string;
}

export interface AppendEntries {
  type: 'AppendEntries';
  term: number;
  leaderId: string;
  prevLogIndex: number;
  prevLogTerm: number;
  entries: LogEntry[];
  leaderCommit: number;
}

export interface AppendEntriesResponse {
  type: 'AppendEntriesResponse';
  term: number;
  success: boolean;
  from: string;
  matchIndex?: number;
}

export interface ClientRequest {
  type: 'ClientRequest';
  command: any;
}

// Raft events (effects)
export type RaftEffect =
  | { becameLeader: { nodeId: string; term: number } }
  | { becameFollower: { nodeId: string; term: number } }
  | { becameCandidate: { nodeId: string; term: number } }
  | { logCommitted: { index: number; entry: LogEntry } }
  | { electionStarted: { nodeId: string; term: number } }
  | { electionWon: { nodeId: string; term: number; votes: number } }
  | { heartbeatSent: { from: string; to: string[] } }
  | { voteGranted: { from: string; to: string; term: number } };