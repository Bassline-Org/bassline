/**
 * Tests for Bidirectional Liveness
 *
 * Verifies that CSP ↔ Network sync works correctly in both directions
 * and converges to a stable state.
 */

import { describe, it, expect } from 'vitest';
import { createLiveCSP } from './liveness';
import { networkEffectsToCSPCommands, extractCSPState } from './csp-reverse';
import { intersectionProto } from '../../cells';
import { withTaps, quick } from '../../../core/context';

describe('CSP Reverse Compilation', () => {
  it('should reverse compile variable definition', () => {
    const liveCSP = createLiveCSP();
    const network = liveCSP.current().network;

    // Forward: CSP command → Network effect
    const factory = () => withTaps(quick(intersectionProto<string>(), new Set(['A', 'B', 'C'])));
    liveCSP.receive({ variable: { name: 'letter', domain: factory } });

    // Check network received it
    const definitions = network.current().definitions.current();
    expect(definitions.has('letter')).toBe(true);

    // Reverse: Network state → CSP commands
    const state = extractCSPState(network.current());
    expect(state.types).toHaveLength(1);
    expect(state.types[0].name).toBe('letter');
  });

  it('should reverse compile variable creation', () => {
    const liveCSP = createLiveCSP();
    const network = liveCSP.current().network;

    // Setup type
    const factory = () => withTaps(quick(intersectionProto<string>(), new Set(['A', 'B', 'C'])));
    liveCSP.receive({ variable: { name: 'letter', domain: factory } });

    // Forward: Create variable
    liveCSP.receive({ create: { id: 'v1', type: 'letter' } });

    // Check network spawned it
    const instances = network.current().spawning.current().instances.current();
    expect(instances.has('v1')).toBe(true);

    // Reverse: Extract state
    const state = extractCSPState(network.current());
    expect(state.variables).toHaveLength(1);
    expect(state.variables[0]).toEqual({
      id: 'v1',
      type: 'letter',
      domain: new Set(['A', 'B', 'C'])
    });
  });

  it('should convert network effects to CSP commands', () => {
    const liveCSP = createLiveCSP();
    const network = liveCSP.current().network;

    // Setup
    const factory = () => withTaps(quick(intersectionProto<string>(), new Set(['R', 'G', 'B'])));
    liveCSP.receive({ variable: { name: 'color', domain: factory } });

    // Manually emit network effect and convert to CSP command
    const effects = { spawned: { id: 'v1' } };

    // First spawn it so instanceTypes is populated
    liveCSP.receive({ create: { id: 'v1', type: 'color' } });

    // Now reverse compile
    const commands = networkEffectsToCSPCommands(effects, network.current());

    expect(commands).toHaveLength(1);
    expect(commands[0]).toHaveProperty('create');
    if ('create' in commands[0]) {
      expect(commands[0].create.id).toBe('v1');
      expect(commands[0].create.type).toBe('color');
    }
  });
});

describe('Liveness', () => {
  it('should sync from CSP to network (forward)', () => {
    const liveCSP = createLiveCSP();

    // Define type
    const factory = () => withTaps(quick(intersectionProto<number>(), new Set([1, 2, 3])));
    liveCSP.receive({ variable: { name: 'digit', domain: factory } });

    // Create variable
    liveCSP.receive({ create: { id: 'v1', type: 'digit' } });

    // Check network reflects it
    const instances = liveCSP.network.current().spawning.current().instances.current();
    expect(instances.has('v1')).toBe(true);

    const v1 = instances.get('v1');
    expect(v1?.current()).toEqual(new Set([1, 2, 3]));
  });

  it('should extract state from network', () => {
    const liveCSP = createLiveCSP();

    // Setup type at CSP level
    const factory = () => withTaps(quick(intersectionProto<string>(), new Set(['X', 'Y', 'Z'])));
    liveCSP.receive({ variable: { name: 'coord', domain: factory } });

    // Create variable at CSP level
    liveCSP.receive({ create: { id: 'c1', type: 'coord' } });

    // Extract state - should reflect what we created
    const state = liveCSP.extractState();

    expect(state.types).toHaveLength(1);
    expect(state.types[0].name).toBe('coord');

    expect(state.variables).toHaveLength(1);
    expect(state.variables[0].id).toBe('c1');
    expect(state.variables[0].type).toBe('coord');
  });

  it('should reflect domain refinements in extracted state', () => {
    const liveCSP = createLiveCSP();

    // Setup
    const factory = () => withTaps(quick(intersectionProto<string>(), new Set(['R', 'G', 'B'])));
    liveCSP.receive({ variable: { name: 'color', domain: factory } });
    liveCSP.receive({ create: { id: 'v1', type: 'color' } });

    // Get direct access to variable
    const instances = liveCSP.network.current().spawning.current().instances.current();
    const v1 = instances.get('v1');

    // Refine domain directly at network level
    v1?.receive(new Set(['R']));

    // Extract state - should show refined domain
    const state = liveCSP.extractState();
    const v1State = state.variables.find(v => v.id === 'v1');

    expect(v1State?.domain).toEqual(new Set(['R']));
  });

  it('should manually sync network changes back to CSP', () => {
    const liveCSP = createLiveCSP();

    // Setup type
    const factory = () => withTaps(quick(intersectionProto<number>(), new Set([1, 2, 3, 4, 5])));
    liveCSP.receive({ variable: { name: 'num', domain: factory } });

    // Modify network directly (bypass CSP)
    liveCSP.network.receive({ spawn: { id: 'n1', type: 'num' } });

    // Manually sync the network effect back to CSP
    liveCSP.syncFromNetwork({ spawned: { id: 'n1' } });

    // CSP should now know about n1
    const state = liveCSP.extractState();
    expect(state.variables.some(v => v.id === 'n1')).toBe(true);
  });
});

describe('Convergence', () => {
  it('should converge when sending same command multiple times (idempotent)', () => {
    const liveCSP = createLiveCSP();

    // Setup
    const factory = () => withTaps(quick(intersectionProto<number>(), new Set([1, 2, 3, 4, 5])));
    liveCSP.receive({ variable: { name: 'num', domain: factory } });

    // Create variable
    liveCSP.receive({ create: { id: 'n1', type: 'num' } });

    const instances = liveCSP.network.current().spawning.current().instances.current();
    const n1 = instances.get('n1');

    const initialDomain = n1?.current();

    // Send same create command again (idempotent)
    liveCSP.receive({ create: { id: 'n1', type: 'num' } });

    const finalDomain = n1?.current();

    // Domain should be unchanged (idempotent)
    expect(finalDomain).toEqual(initialDomain);
  });

  it('should converge with domain refinements (ACI)', () => {
    const liveCSP = createLiveCSP();

    // Setup
    const factory = () => withTaps(quick(intersectionProto<number>(), new Set([1, 2, 3, 4, 5])));
    liveCSP.receive({ variable: { name: 'num', domain: factory } });
    liveCSP.receive({ create: { id: 'n1', type: 'num', domain: new Set([1, 2, 3]) } });

    const instances = liveCSP.network.current().spawning.current().instances.current();
    const n1 = instances.get('n1');

    // Refine at network level
    n1?.receive(new Set([1, 2]));

    // Refine at CSP level with same domain (should be idempotent)
    liveCSP.receive({ create: { id: 'n1', type: 'num', domain: new Set([1, 2]) } });

    // Check final domain (intersection: [1,2] ∩ [1,2] = [1,2])
    expect(n1?.current()).toEqual(new Set([1, 2]));

    // Further refinement
    n1?.receive(new Set([1]));

    // Sending [1,2] again should not undo the [1] refinement
    // Because intersection: [1] ∩ [1,2] = [1]
    liveCSP.receive({ create: { id: 'n1', type: 'num', domain: new Set([1, 2]) } });

    expect(n1?.current()).toEqual(new Set([1]));
  });
});

describe('Integration', () => {
  it('should support full workflow: define, create, refine, extract', () => {
    const liveCSP = createLiveCSP();

    // 1. Define types
    const colorFactory = () => withTaps(quick(intersectionProto<string>(), new Set(['R', 'G', 'B'])));
    liveCSP.receive({ variable: { name: 'color', domain: colorFactory } });

    // 2. Create variables
    liveCSP.receive({ create: { id: 'v1', type: 'color' } });
    liveCSP.receive({ create: { id: 'v2', type: 'color' } });

    // 3. Extract state
    let state = liveCSP.extractState();

    expect(state.types).toHaveLength(1);
    expect(state.variables).toHaveLength(2);

    // 4. Refine domains
    const instances = liveCSP.network.current().spawning.current().instances.current();
    instances.get('v1')?.receive(new Set(['R', 'G']));
    instances.get('v2')?.receive(new Set(['G', 'B']));

    // 5. Check refinements
    state = liveCSP.extractState();
    const v1State = state.variables.find(v => v.id === 'v1');
    const v2State = state.variables.find(v => v.id === 'v2');

    expect(v1State?.domain).toEqual(new Set(['R', 'G']));
    expect(v2State?.domain).toEqual(new Set(['G', 'B']));
  });

  it('should support direct network access', () => {
    const liveCSP = createLiveCSP();

    // Setup
    const factory = () => withTaps(quick(intersectionProto<number>(), new Set([1, 2, 3])));
    liveCSP.receive({ variable: { name: 'num', domain: factory } });

    // Access network directly
    expect(liveCSP.network).toBeDefined();
    expect(typeof liveCSP.network.receive).toBe('function');

    // Create via CSP (forward works automatically)
    liveCSP.receive({ create: { id: 'n1', type: 'num' } });

    // Network should have the instance
    const instances = liveCSP.network.current().spawning.current().instances.current();
    expect(instances.has('n1')).toBe(true);
  });
});
