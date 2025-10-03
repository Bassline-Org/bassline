/**
 * Tests for CSP DSL
 */

import { describe, it, expect } from 'vitest';
import { createCSPGadget } from './csp';
import { quick, withTaps } from '../../../core/context';
import { intersectionProto } from '../../cells';

describe('CSP DSL', () => {
  it('should create a CSP gadget', () => {
    const csp = createCSPGadget();
    expect(csp).toBeDefined();
    expect(typeof csp.receive).toBe('function');
    expect(typeof csp.current).toBe('function');
    expect(typeof csp.tap).toBe('function');
  });

  it('should define a variable type', () => {
    const csp = createCSPGadget();
    const emissions: any[] = [];
    csp.tap(e => emissions.push(e));

    csp.receive({
      variable: {
        name: 'color',
        domain: () => withTaps(quick(intersectionProto(), new Set(['R', 'G', 'B'])))
      }
    });

    expect(emissions[0]).toHaveProperty('variableDefined');
    expect(emissions[0].variableDefined).toEqual({ name: 'color' });

    // Check it was registered in the network
    const network = csp.current().network;
    expect(network.current().definitions.current().has('color')).toBe(true);
  });

  it('should create a variable instance', () => {
    const csp = createCSPGadget();
    const emissions: any[] = [];
    csp.tap(e => emissions.push(e));

    // Define type
    csp.receive({
      variable: {
        name: 'color',
        domain: () => withTaps(quick(intersectionProto(), new Set(['R', 'G', 'B'])))
      }
    });

    // Create instance
    csp.receive({
      create: { id: 'v1', type: 'color' }
    });

    expect(emissions[1]).toHaveProperty('created');
    expect(emissions[1].created).toEqual({ id: 'v1' });

    // Check instance exists
    const network = csp.current().network;
    const instances = network.current().spawning.current().instances.current();
    expect(instances.has('v1')).toBe(true);
  });

  it('should create a variable with initial domain', () => {
    const csp = createCSPGadget();

    // Define type
    csp.receive({
      variable: {
        name: 'color',
        domain: () => withTaps(quick(intersectionProto(), new Set(['R', 'G', 'B'])))
      }
    });

    // Create with initial domain
    csp.receive({
      create: {
        id: 'v1',
        type: 'color',
        domain: new Set(['R', 'G'])
      }
    });

    // Check domain was set
    const network = csp.current().network;
    const instances = network.current().spawning.current().instances.current();
    const v1 = instances.get('v1');
    expect(v1.current()).toEqual(new Set(['R', 'G']));
  });

  it('should error when creating unknown variable type', () => {
    const csp = createCSPGadget();
    const emissions: any[] = [];
    csp.tap(e => emissions.push(e));

    csp.receive({
      create: { id: 'v1', type: 'unknown' }
    });

    expect(emissions[0]).toHaveProperty('error');
    expect(emissions[0].error.type).toBe('unknown_type');
  });

  it('should establish a constraint relationship', () => {
    const csp = createCSPGadget();
    const emissions: any[] = [];
    csp.tap(e => emissions.push(e));

    // Setup variables
    csp.receive({
      variable: {
        name: 'color',
        domain: () => withTaps(quick(intersectionProto(), new Set(['R', 'G', 'B'])))
      }
    });

    csp.receive({ create: { id: 'v1', type: 'color' } });
    csp.receive({ create: { id: 'v2', type: 'color' } });

    // Relate them
    const notEqual = (d1: Set<string>, d2: Set<string>) => [
      new Set([...d1].filter(x => !d2.has(x))),
      new Set([...d2].filter(x => !d1.has(x)))
    ];

    csp.receive({
      relate: {
        vars: ['v1', 'v2'],
        constraint: notEqual
      }
    });

    // Check related effect
    const relatedEffect = emissions.find(e => 'related' in e);
    expect(relatedEffect).toBeDefined();
    expect(relatedEffect?.related).toEqual({ vars: ['v1', 'v2'] });

    // Check propagator was created and wired
    const network = csp.current().network;
    const connections = network.current().wiring.current().cleanups.current();
    expect(connections.size).toBeGreaterThan(0);
  });

  it('should propagate constraints when variable changes', async () => {
    const csp = createCSPGadget();

    // Setup
    csp.receive({
      variable: {
        name: 'color',
        domain: () => withTaps(quick(intersectionProto(), new Set(['R', 'G', 'B'])))
      }
    });

    csp.receive({ create: { id: 'v1', type: 'color' } });
    csp.receive({ create: { id: 'v2', type: 'color' } });

    // Not equal constraint
    const notEqual = (d1: Set<string>, d2: Set<string>) => [
      new Set([...d1].filter(x => !d2.has(x) || d1.size === 1)),
      new Set([...d2].filter(x => !d1.has(x) || d2.size === 1))
    ];

    csp.receive({
      relate: {
        vars: ['v1', 'v2'],
        constraint: notEqual
      }
    });

    // Get variables
    const network = csp.current().network;
    const instances = network.current().spawning.current().instances.current();
    const v1 = instances.get('v1');
    const v2 = instances.get('v2');

    // Initial state
    expect(v1.current()).toEqual(new Set(['R', 'G', 'B']));
    expect(v2.current()).toEqual(new Set(['R', 'G', 'B']));

    // Constrain v1 to Red
    v1.receive(new Set(['R']));

    // Wait for propagation (taps are fire-and-forget)
    await new Promise(r => setTimeout(r, 50));

    // v2 should exclude Red
    expect(v1.current()).toEqual(new Set(['R']));
    expect(v2.current()).toEqual(new Set(['G', 'B']));
  });

  it('should error when relating non-existent variables', () => {
    const csp = createCSPGadget();
    const emissions: any[] = [];
    csp.tap(e => emissions.push(e));

    csp.receive({
      relate: {
        vars: ['v1', 'v2'],
        constraint: (d1, d2) => [d1, d2]
      }
    });

    expect(emissions[0]).toHaveProperty('error');
    expect(emissions[0].error.type).toBe('variable_not_found');
  });

  it('should handle multiple constraints on same variable', async () => {
    const csp = createCSPGadget();

    // Setup
    csp.receive({
      variable: {
        name: 'num',
        domain: () => withTaps(quick(intersectionProto(), new Set([1, 2, 3, 4, 5])))
      }
    });

    csp.receive({ create: { id: 'x', type: 'num' } });
    csp.receive({ create: { id: 'y', type: 'num' } });
    csp.receive({ create: { id: 'z', type: 'num' } });

    // x ≠ y
    const notEqual = (d1: Set<number>, d2: Set<number>) => [
      new Set([...d1].filter(x => !d2.has(x) || d1.size === 1)),
      new Set([...d2].filter(x => !d1.has(x) || d2.size === 1))
    ];

    csp.receive({ relate: { vars: ['x', 'y'], constraint: notEqual } });
    csp.receive({ relate: { vars: ['x', 'z'], constraint: notEqual } });

    // Get variables
    const network = csp.current().network;
    const instances = network.current().spawning.current().instances.current();
    const x = instances.get('x');
    const y = instances.get('y');
    const z = instances.get('z');

    // Constrain x
    x.receive(new Set([1]));

    await new Promise(r => setTimeout(r, 50));

    // Both y and z should exclude 1
    expect(x.current()).toEqual(new Set([1]));
    expect([...y.current()]).not.toContain(1);
    expect([...z.current()]).not.toContain(1);
  });

  it('should introspect network structure', () => {
    const csp = createCSPGadget();
    const emissions: any[] = [];
    csp.tap(e => emissions.push(e));

    // Setup
    csp.receive({
      variable: {
        name: 'color',
        domain: () => withTaps(quick(intersectionProto(), new Set(['R', 'G', 'B'])))
      }
    });

    csp.receive({ create: { id: 'v1', type: 'color' } });
    csp.receive({ create: { id: 'v2', type: 'color' } });

    // Introspect
    csp.receive({ introspect: {} });

    // Find introspection result
    const introspected = emissions.find(e => 'introspected' in e)?.introspected;
    expect(introspected).toBeDefined();

    // Should have type definition
    expect(introspected.types).toContainEqual({ name: 'color' });

    // Should have variables
    expect(introspected.variables).toHaveLength(2);
    expect(introspected.variables.map(v => v.id)).toContain('v1');
    expect(introspected.variables.map(v => v.id)).toContain('v2');

    // Variables should have domains
    const v1 = introspected.variables.find((v: any) => v.id === 'v1');
    expect(v1?.domain).toEqual(new Set(['R', 'G', 'B']));
  });
});
