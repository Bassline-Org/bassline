#!/usr/bin/env tsx
/**
 * Two-Phase Commit Protocol as a Self-Assembling Choreography
 *
 * Shows how a distributed protocol can be described and instantiated
 * using gadgets themselves.
 */

import { createGadget, Gadget } from '../../src/core';
import { changed } from '../../src/effects';
import { choreography, twoPhaseCommit } from '../../src/patterns/choreography/choreography';

// Coordinator gadget factory
function createCoordinator() {
  return createGadget<
    { phase: 'idle' | 'preparing' | 'committing' | 'aborting'; votes: Record<string, boolean> },
    { prepare: any } | { vote: { from: string; vote: boolean } } | { timeout: true }
  >(
    (current, incoming) => {
      if ('prepare' in incoming && current.phase === 'idle') {
        return { action: 'startPrepare' };
      }
      if ('vote' in incoming && current.phase === 'preparing') {
        return { action: 'recordVote', context: incoming.vote };
      }
      if ('timeout' in incoming && current.phase === 'preparing') {
        return { action: 'abort' };
      }
      return null;
    },
    {
      'startPrepare': (gadget) => {
        gadget.update({ phase: 'preparing', votes: {} });
        return changed({ prepare: true }); // Broadcast prepare
      },
      'recordVote': (gadget, vote) => {
        const state = gadget.current();
        state.votes[vote.from] = vote.vote;
        gadget.update(state);

        // Check if all voted
        const voteCount = Object.keys(state.votes).length;
        if (voteCount >= 2) { // Expecting 2 participants
          const allYes = Object.values(state.votes).every(v => v === true);
          if (allYes) {
            gadget.update({ ...state, phase: 'committing' });
            return changed({ decision: 'commit' });
          } else {
            gadget.update({ ...state, phase: 'aborting' });
            return changed({ decision: 'abort' });
          }
        }
        return null;
      },
      'abort': (gadget) => {
        gadget.update({ ...gadget.current(), phase: 'aborting' });
        return changed({ decision: 'abort' });
      }
    }
  );
}

// Participant gadget factory
function createParticipant(id: string) {
  return createGadget<
    { id: string; prepared: boolean; committed: boolean },
    { prepare: true } | { decision: string }
  >(
    (current, incoming) => {
      if ('prepare' in incoming && !current.prepared) {
        return { action: 'prepare' };
      }
      if ('decision' in incoming) {
        return { action: incoming.decision as 'commit' | 'abort' };
      }
      return null;
    },
    {
      'prepare': (gadget) => {
        const canCommit = Math.random() > 0.3; // 70% chance of yes vote
        gadget.update({ ...gadget.current(), prepared: true });
        console.log(`  [${gadget.current().id}] Voting: ${canCommit ? 'YES' : 'NO'}`);
        return changed({ vote: { from: gadget.current().id, vote: canCommit } });
      },
      'commit': (gadget) => {
        gadget.update({ ...gadget.current(), committed: true });
        console.log(`  [${gadget.current().id}] COMMITTED`);
        return changed({ committed: gadget.current().id });
      },
      'abort': (gadget) => {
        gadget.update({ ...gadget.current(), prepared: false });
        console.log(`  [${gadget.current().id}] ABORTED`);
        return changed({ aborted: gadget.current().id });
      }
    }
  );
}

// Main demo
console.log('=== Two-Phase Commit Choreography ===\n');

console.log('1. DEFINING CHOREOGRAPHY');

// Create the choreography gadget
const choreo = choreography({
  spec: undefined,
  participants: {},
  wired: false,
  active: false
});

// Monitor choreography events
choreo.emit = (effect) => {
  if (effect?.changed?.instantiated) {
    console.log('  Choreography instantiated:', effect.changed.instantiated);
  }
  if (effect?.changed?.started) {
    console.log('  Choreography started with participants:', effect.changed.started);
  }
};

// Get the two-phase commit pattern
const pattern = twoPhaseCommit();
console.log('  Pattern: Two-Phase Commit');
console.log('  Roles:', pattern.instantiate.roles.map(r => r.name));
console.log('  Relationships:', pattern.instantiate.relationships.length, 'connections\n');

console.log('2. INSTANTIATING CHOREOGRAPHY');

// Add gadget factories for each role type
pattern.instantiate.factories = {
  'coordinator': () => createCoordinator()({ phase: 'idle', votes: {} }),
  'participant': () => {
    const id = `participant-${Math.random().toString(36).substr(2, 5)}`;
    return createParticipant(id)({ id, prepared: false, committed: false });
  }
};

// Instantiate the choreography
choreo.receive(pattern);

console.log('\n3. STARTING PROTOCOL');
choreo.receive({ start: true });

// Get participants from choreography
const state = choreo.current();
const coordinator = state.participants['coordinator'];
const p1 = state.participants['participant1'];
const p2 = state.participants['participant2'];

// Wire voting responses back to coordinator
if (coordinator && p1 && p2) {
  const coordEmit = coordinator.emit;

  p1.emit = (effect: any) => {
    if (effect?.changed?.vote) {
      coordinator.receive({ vote: effect.changed.vote });
    }
  };

  p2.emit = (effect: any) => {
    if (effect?.changed?.vote) {
      coordinator.receive({ vote: effect.changed.vote });
    }
  };

  // Wire coordinator decisions to participants
  coordinator.emit = (effect: any) => {
    coordEmit(effect);
    if (effect?.changed?.prepare) {
      console.log('  [Coordinator] Sending PREPARE to all participants');
      p1.receive({ prepare: true });
      p2.receive({ prepare: true });
    }
    if (effect?.changed?.decision) {
      console.log(`  [Coordinator] Sending ${effect.changed.decision.toUpperCase()} decision`);
      p1.receive({ decision: effect.changed.decision });
      p2.receive({ decision: effect.changed.decision });
    }
  };
}

console.log('\n4. EXECUTING PROTOCOL');

// Start the protocol
coordinator?.receive({ prepare: {} });

// Check final state after a delay
setTimeout(() => {
  console.log('\n5. FINAL STATE');
  console.log('  Coordinator phase:', coordinator?.current().phase);
  console.log('  Participant 1 committed:', p1?.current().committed);
  console.log('  Participant 2 committed:', p2?.current().committed);

  console.log('\n=== Key Insights ===');
  console.log('• Choreography is itself a gadget');
  console.log('• Protocol described declaratively (roles + relationships)');
  console.log('• Participants instantiated and wired automatically');
  console.log('• Protocol execution emerges from gadget interactions');
}, 1000);