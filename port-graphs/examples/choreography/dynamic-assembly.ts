#!/usr/bin/env tsx
/**
 * Dynamic Choreography Assembly
 *
 * Shows how choreographies can be built from partial information
 * and modified at runtime
 */

import { createSelfAssemblingChoreography, runtimeChoreography } from '../../src/patterns/choreography/dynamic';
import { createGadget } from '../../src/core';
import { changed } from '../../src/effects';

console.log('=== Dynamic Choreography Assembly ===\n');

console.log('1. PARTIAL CONSTRUCTION');

// Create a self-assembling choreography
const assembly = createSelfAssemblingChoreography();

// Monitor assembly events
let instantiated = false;
assembly.emit = (effect) => {
  console.log('  [Assembly]', JSON.stringify(effect, null, 2));
  if (effect?.changed?.instantiated) {
    instantiated = true;
  }
};

console.log('  Created self-assembling choreography\n');

console.log('2. ADDING COMPONENTS OVER TIME');

// Simulate components being added from different sources at different times
setTimeout(() => {
  console.log('  [Source A] Adding buyer role...');
  assembly.receive({
    role: {
      name: 'buyer',
      type: 'participant',
      capabilities: ['negotiate', 'pay']
    }
  });
}, 100);

setTimeout(() => {
  console.log('  [Source B] Adding seller role...');
  assembly.receive({
    role: {
      name: 'seller',
      type: 'participant',
      capabilities: ['negotiate', 'deliver']
    }
  });
}, 200);

setTimeout(() => {
  console.log('  [Source C] Adding negotiation relationship...');
  assembly.receive({
    relationship: {
      from: 'buyer',
      to: 'seller',
      type: 'responds',
      protocol: 'negotiate'
    }
  });
}, 300);

setTimeout(() => {
  console.log('  [Source D] Adding payment relationship...');
  assembly.receive({
    relationship: {
      from: 'buyer',
      to: 'seller',
      type: 'sends',
      protocol: 'payment'
    }
  });
}, 400);

// After all components added, test runtime modification
setTimeout(() => {
  if (instantiated) {
    console.log('\n3. RUNTIME MODIFICATION');

    // Create runtime choreography manager
    const runtime = runtimeChoreography({
      participants: {
        buyer: createGadget(
          (_s, data) => ({ action: 'log', context: { data } }),
          { 'log': (_g, { data }) => {
            console.log('    [Buyer] Received:', data);
            return changed({ buyer: data });
          }}
        )({}),
        seller: createGadget(
          (_s, data) => ({ action: 'log', context: { data } }),
          { 'log': (_g, { data }) => {
            console.log('    [Seller] Received:', data);
            return changed({ seller: data });
          }}
        )({})
      },
      roles: {
        buyer: { name: 'buyer', type: 'participant', capabilities: ['negotiate', 'pay'] },
        seller: { name: 'seller', type: 'participant', capabilities: ['negotiate', 'deliver'] }
      },
      relationships: [],
      active: true
    });

    // Monitor runtime events
    runtime.emit = (effect) => {
      console.log('  [Runtime]', JSON.stringify(effect, null, 2));
    };

    // Add a new participant at runtime
    console.log('  Adding escrow agent at runtime...');
    runtime.receive({
      addParticipant: {
        role: {
          name: 'escrow',
          type: 'mediator',
          capabilities: ['hold', 'release']
        }
      }
    });

    // Add new relationship
    console.log('  Wiring escrow into payment flow...');
    runtime.receive({
      addRelationship: {
        from: 'buyer',
        to: 'escrow',
        type: 'sends',
        protocol: 'deposit'
      }
    });

    runtime.receive({
      addRelationship: {
        from: 'escrow',
        to: 'seller',
        type: 'sends',
        protocol: 'release'
      }
    });

    // Replace a participant
    console.log('  Replacing buyer with premium buyer...');
    const premiumBuyer = createGadget(
      (_s, data) => ({ action: 'premium', context: { data } }),
      { 'premium': (_g, { data }) => {
        console.log('    [Premium Buyer] Priority processing:', data);
        return changed({ premiumBuyer: data });
      }}
    )({});

    runtime.receive({
      replaceParticipant: {
        role: 'buyer',
        newGadget: premiumBuyer
      }
    });

    console.log('\n4. FINAL CHOREOGRAPHY STATE');
    const finalState = runtime.current();
    console.log('  Participants:', Object.keys(finalState.participants));
    console.log('  Relationships:', finalState.relationships.length);
    console.log('  Active:', finalState.active);
  }
}, 600);

setTimeout(() => {
  console.log('\n=== Key Achievements ===');
  console.log('✓ Choreography assembled from partial information');
  console.log('✓ Components added from different sources over time');
  console.log('✓ Participants added/replaced at runtime');
  console.log('✓ Relationships modified dynamically');
  console.log('✓ No restart required for changes');
  process.exit(0);
}, 800);