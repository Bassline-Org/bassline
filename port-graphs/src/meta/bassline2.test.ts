import { describe, it, expect } from 'vitest';
import { basslineGadget } from './bassline2';
import { withTaps } from '../core/typed';
import { maxCell, lastCell } from '../patterns/cells/typed-cells';
import { sliderGadget } from '../patterns/ui/typed-ui';

describe('Bassline2 - Decoupled Architecture', () => {
  describe('basic operations', () => {
    it('should create gadget instances through factory processor', () => {
      const bassline = withTaps(basslineGadget({
        factories: {
          max: maxCell,
          last: lastCell,
          slider: sliderGadget
        }
      }));

      // Note: We need to observe the factory processor's effects
      // Since the architecture is decoupled, we'll check the registry

      bassline.receive({ create: { id: 'maxGadget', type: 'max', args: [10] } });

      // Give it a moment for the decoupled processors to work
      const state = (bassline as any).current();
      const registry = state.registry.current();
      expect(registry['maxGadget']).toBeDefined();
      expect(registry['maxGadget'].current()).toBe(10);
    });

    it('should wire gadgets through topology and wiring processor', () => {
      const bassline = withTaps(basslineGadget({
        factories: {
          max: maxCell,
          last: lastCell
        }
      }));

      // Create two gadgets
      bassline.receive({ create: { id: 'source', type: 'last', args: [5] } });
      bassline.receive({ create: { id: 'target', type: 'max', args: [0] } });

      // Wire them together
      bassline.receive({
        wire: {
          id: 'connection1',
          from: 'source',
          to: 'target',
          pattern: 'extract',
          args: ['changed']
        }
      });

      // Check topology has the edge
      const state = (bassline as any).current();
      const topology = state.topology.current();
      expect(topology['connection1']).toBeDefined();
      expect(topology['connection1'].from).toBe('source');
      expect(topology['connection1'].to).toBe('target');

      // Test that wiring actually works
      const registry = state.registry.current();
      const source = registry['source'] as any;
      const target = registry['target'] as any;

      source.receive(20);
      expect(target.current()).toBe(20);
    });

    it('should disconnect wired gadgets', () => {
      const bassline = withTaps(basslineGadget({
        factories: {
          last: lastCell,
          max: maxCell
        }
      }));

      // Create and wire gadgets
      bassline.receive({ create: { id: 'source', type: 'last', args: [5] } });
      bassline.receive({ create: { id: 'target', type: 'max', args: [0] } });
      bassline.receive({
        wire: {
          id: 'conn1',
          from: 'source',
          to: 'target',
          pattern: 'extract',
          args: ['changed']
        }
      });

      const state = (bassline as any).current();
      const registry = state.registry.current();
      const source = registry['source'] as any;
      const target = registry['target'] as any;

      // Verify connection works
      source.receive(10);
      expect(target.current()).toBe(10);

      // Disconnect
      bassline.receive({ disconnect: 'conn1' });

      // Verify topology updated
      const topology = state.topology.current();
      expect(topology['conn1']).toBeUndefined();

      // Verify connection no longer works
      source.receive(20);
      expect(target.current()).toBe(10); // Should still be 10
    });

    it('should register new factories dynamically', () => {
      const bassline = withTaps(basslineGadget());

      // Register a factory
      bassline.receive({
        registerFactory: {
          name: 'myCell',
          factory: (init: number) => lastCell(init)
        }
      });

      // Check namespace updated
      const state = (bassline as any).current();
      const namespace = state.namespace.current();
      expect(namespace['myCell']).toBeDefined();

      // Use the registered factory
      bassline.receive({ create: { id: 'test', type: 'myCell', args: [42] } });

      const registry = state.registry.current();
      expect(registry['test']).toBeDefined();
      expect(registry['test'].current()).toBe(42);
    });

    it('should destroy instances and clean up edges', () => {
      const bassline = withTaps(basslineGadget({
        factories: {
          last: lastCell,
          max: maxCell
        }
      }));

      // Create three gadgets
      bassline.receive({ create: { id: 'a', type: 'last', args: [1] } });
      bassline.receive({ create: { id: 'b', type: 'max', args: [0] } });
      bassline.receive({ create: { id: 'c', type: 'max', args: [0] } });

      // Wire a to both b and c
      bassline.receive({
        wire: {
          id: 'conn1',
          from: 'a',
          to: 'b',
          pattern: 'extract',
          args: ['changed']
        }
      });
      bassline.receive({
        wire: {
          id: 'conn2',
          from: 'a',
          to: 'c',
          pattern: 'extract',
          args: ['changed']
        }
      });

      const state = (bassline as any).current();

      // Verify edges exist
      let topology = state.topology.current();
      expect(topology['conn1']).toBeDefined();
      expect(topology['conn2']).toBeDefined();

      // Destroy gadget 'a'
      bassline.receive({ destroy: 'a' });

      // Verify 'a' is gone from registry
      const registry = state.registry.current();
      expect(registry['a']).toBeUndefined();
      expect(registry['b']).toBeDefined();
      expect(registry['c']).toBeDefined();

      // Verify edges involving 'a' are gone from topology
      topology = state.topology.current();
      expect(topology['conn1']).toBeUndefined();
      expect(topology['conn2']).toBeUndefined();
    });
  });

  describe('decoupling verification', () => {
    it('should separate topology from wiring', () => {
      const bassline = withTaps(basslineGadget({
        factories: {
          last: lastCell
        }
      }));

      const state = (bassline as any).current();
      const topology = state.topology;
      const registry = state.registry;

      // Create instances
      bassline.receive({ create: { id: 'a', type: 'last', args: [1] } });
      bassline.receive({ create: { id: 'b', type: 'last', args: [2] } });

      // Add edge to topology
      bassline.receive({
        wire: {
          id: 'edge1',
          from: 'a',
          to: 'b',
          pattern: 'extract',
          args: ['changed']
        }
      });

      // Topology should just have data
      const topologyData = topology.current();
      expect(topologyData['edge1']).toEqual({
        from: 'a',
        to: 'b',
        pattern: 'extract',
        args: ['changed']
      });

      // Registry should be independent
      const instances = registry.current();
      expect(instances['a']).toBeDefined();
      expect(instances['b']).toBeDefined();

      // But wiring should work (through the processor)
      instances['a'].receive(10);
      expect(instances['b'].current()).toBe(10);
    });

    it('should allow observing table changes independently', () => {
      const bassline = withTaps(basslineGadget());
      const state = (bassline as any).current();

      const namespaceChanges: any[] = [];
      const topologyChanges: any[] = [];

      // Observe namespace changes
      state.namespace.tap(({ added }: any) => {
        if (added) namespaceChanges.push(added);
      });

      // Observe topology changes
      state.topology.tap(({ added }: any) => {
        if (added) topologyChanges.push(added);
      });

      // Register a factory
      bassline.receive({
        registerFactory: {
          name: 'test',
          factory: lastCell
        }
      });

      // Add an edge (will fail without instances, but topology should update)
      bassline.receive({
        wire: {
          id: 'edge1',
          from: 'x',
          to: 'y',
          pattern: 'extract'
        }
      });

      // Check we observed the changes
      expect(namespaceChanges.length).toBe(1);
      expect(namespaceChanges[0]).toHaveProperty('test');
      expect(topologyChanges.length).toBe(1);
      expect(topologyChanges[0]).toHaveProperty('edge1');
    });
  });
});