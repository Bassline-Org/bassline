/**
 * Tests for Network Bassline
 */

import { describe, it, expect } from 'vitest';
import { createNetworkBassline } from './network';
import { withTaps, quick } from '../../core';
import { maxProto } from '../cells';
import { transformProto } from '../functions';

describe('Network Bassline', () => {
  it('should create a network bassline', () => {
    const network = createNetworkBassline();
    expect(network).toBeDefined();
    expect(typeof network.receive).toBe('function');
    expect(typeof network.current).toBe('function');
    expect(typeof network.tap).toBe('function');
  });

  it('should define a factory', () => {
    const network = createNetworkBassline();
    const emissions: any[] = [];
    network.tap(e => emissions.push(e));

    network.receive({
      define: {
        name: 'counter',
        factory: () => withTaps(quick(maxProto, 0))
      }
    });

    expect(emissions[0]).toHaveProperty('defined', 'counter');
    expect(network.current().factories.current().has('counter')).toBe(true);
  });

  it('should spawn an instance from a factory', () => {
    const network = createNetworkBassline();
    const emissions: any[] = [];
    network.tap(e => emissions.push(e));

    // Define factory
    network.receive({
      define: {
        name: 'counter',
        factory: () => withTaps(quick(maxProto, 0))
      }
    });

    // Spawn instance
    network.receive({
      spawn: { id: 'c1', type: 'counter' }
    });

    expect(emissions[1]).toHaveProperty('spawned');
    expect(emissions[1].spawned).toEqual({ id: 'c1' });
    expect(network.current().instances.current().has('c1')).toBe(true);
  });

  it('should error when spawning unknown type', () => {
    const network = createNetworkBassline();
    const emissions: any[] = [];
    network.tap(e => emissions.push(e));

    network.receive({
      spawn: { id: 'c1', type: 'unknown' }
    });

    expect(emissions[0]).toHaveProperty('error');
    expect(emissions[0].error.type).toBe('unknown_type');
  });

  it('should wire two gadgets together', () => {
    const network = createNetworkBassline();
    const emissions: any[] = [];
    network.tap(e => emissions.push(e));

    // Define factories
    network.receive({
      define: {
        name: 'counter',
        factory: () => withTaps(quick(maxProto, 0))
      }
    });

    network.receive({
      define: {
        name: 'doubler',
        factory: () => withTaps(quick(transformProto((x: number) => x * 2), undefined))
      }
    });

    // Spawn instances
    network.receive({ spawn: { id: 'c1', type: 'counter' } });
    network.receive({ spawn: { id: 'd1', type: 'doubler' } });

    // Wire them
    network.receive({
      wire: { from: 'c1', to: 'd1', via: 'changed' }
    });

    // Check that wiring happened (may include ignore fields from other handlers)
    const wireEffect = emissions.find(e => 'wired' in e);
    expect(wireEffect).toBeDefined();
    expect(wireEffect?.wired).toEqual({ from: 'c1', to: 'd1' });
    expect(network.current().connections.current().size).toBe(1);
  });

  it('should propagate data through wired gadgets', () => {
    const network = createNetworkBassline();

    // Define and spawn
    network.receive({
      define: {
        name: 'counter',
        factory: () => withTaps(quick(maxProto, 0))
      }
    });

    network.receive({
      define: {
        name: 'doubler',
        factory: () => withTaps(quick(transformProto((x: number) => x * 2), undefined))
      }
    });

    network.receive({ spawn: { id: 'c1', type: 'counter' } });
    network.receive({ spawn: { id: 'd1', type: 'doubler' } });

    // Wire them
    network.receive({ wire: { from: 'c1', to: 'd1', via: 'changed' } });

    // Get instances
    const counter = network.current().instances.current().get('c1');
    const doubler = network.current().instances.current().get('d1');

    // Verify initial state
    expect(counter.current()).toBe(0);
    expect(doubler.current()).toBe(undefined);

    // Send data to counter
    counter.receive(5);

    // Should propagate to doubler
    expect(counter.current()).toBe(5);
    expect(doubler.current()).toBe(10); // 5 * 2
  });

  it('should destroy an instance and cleanup connections', () => {
    const network = createNetworkBassline();
    const emissions: any[] = [];
    network.tap(e => emissions.push(e));

    // Setup
    network.receive({
      define: {
        name: 'counter',
        factory: () => withTaps(quick(maxProto, 0))
      }
    });

    network.receive({ spawn: { id: 'c1', type: 'counter' } });
    network.receive({ spawn: { id: 'c2', type: 'counter' } });
    network.receive({ wire: { from: 'c1', to: 'c2' } });

    const connectionsBefore = network.current().connections.current().size;
    expect(connectionsBefore).toBe(1);

    // Destroy c1
    network.receive({ destroy: 'c1' });

    // Check emissions (may include ignore fields)
    const destroyedEffect = emissions.find(e => 'destroyed' in e);
    expect(destroyedEffect).toBeDefined();
    expect(destroyedEffect?.destroyed).toBe('c1');

    // Check instance removed
    expect(network.current().instances.current().has('c1')).toBe(false);

    // Check connections cleaned up
    expect(network.current().connections.current().size).toBe(0);
  });

  it('should disable and enable the network', () => {
    const network = createNetworkBassline();
    const emissions: any[] = [];
    network.tap(e => emissions.push(e));

    // Define factory
    network.receive({
      define: {
        name: 'counter',
        factory: () => withTaps(quick(maxProto, 0))
      }
    });

    // Disable network
    network.receive({ disable: {} });
    expect(emissions.some(e => 'disabled' in e)).toBe(true);

    // Try to spawn (should be ignored - step returns ignore, which gets emitted)
    const emissionsBeforeIgnored = emissions.length;
    network.receive({ spawn: { id: 'c1', type: 'counter' } });
    // Step returns { ignore: {} } which gets emitted, so we expect one more emission
    expect(emissions.length).toBe(emissionsBeforeIgnored + 1);
    expect(emissions[emissions.length - 1]).toEqual({ ignore: {} });

    // Enable network
    network.receive({ enable: {} });
    expect(emissions.some(e => 'enabled' in e)).toBe(true);

    // Now spawn should work
    network.receive({ spawn: { id: 'c1', type: 'counter' } });
    expect(network.current().instances.current().has('c1')).toBe(true);
  });

  it('should error when wiring non-existent gadgets', () => {
    const network = createNetworkBassline();
    const emissions: any[] = [];
    network.tap(e => emissions.push(e));

    network.receive({ wire: { from: 'c1', to: 'c2' } });

    expect(emissions[0]).toHaveProperty('error');
    expect(emissions[0].error.type).toBe('not_found');
  });

  it('should support multiple wires from same source', () => {
    const network = createNetworkBassline();

    // Setup
    network.receive({
      define: {
        name: 'counter',
        factory: () => withTaps(quick(maxProto, 0))
      }
    });

    network.receive({ spawn: { id: 'c1', type: 'counter' } });
    network.receive({ spawn: { id: 'c2', type: 'counter' } });
    network.receive({ spawn: { id: 'c3', type: 'counter' } });

    // Wire c1 to both c2 and c3
    network.receive({ wire: { from: 'c1', to: 'c2' } });
    network.receive({ wire: { from: 'c1', to: 'c3' } });

    expect(network.current().connections.current().size).toBe(2);

    // Send data
    const c1 = network.current().instances.current().get('c1');
    const c2 = network.current().instances.current().get('c2');
    const c3 = network.current().instances.current().get('c3');

    c1.receive(10);

    // Both should receive the value
    expect(c2.current()).toBe(10);
    expect(c3.current()).toBe(10);
  });
});
