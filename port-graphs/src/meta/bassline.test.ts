import { describe, it, expect } from 'vitest';
import { basslineGadget } from './bassline';
import { withTaps } from '../core/typed';
import { maxCell, lastCell } from '../patterns/cells/typed-cells';
import { sliderGadget } from '../patterns/ui/typed-ui';

describe('Bassline', () => {
  describe('basic operations', () => {
    it('should create gadget instances', () => {
      const bassline = withTaps(basslineGadget({
        factories: {
          max: maxCell,
          last: lastCell,
          slider: sliderGadget
        }
      }));

      let createdEvent: any;
      bassline.tap(({ created }) => {
        if (created) createdEvent = created;
      });

      // Create a max cell
      bassline.receive({ create: { id: 'maxGadget', type: 'max', args: [10] } });
      expect(createdEvent).toEqual({ id: 'maxGadget', type: 'max' });

      // Verify instance exists in registry
      const registry = bassline.current().registry.current();
      expect(registry['maxGadget']).toBeDefined();
      expect(registry['maxGadget'].current()).toBe(10);

      // Create a slider
      bassline.receive({ create: { id: 'mySlider', type: 'slider', args: [50, 0, 100, 1] } });

      // Get fresh registry after creation
      const registry2 = bassline.current().registry.current();
      expect(registry2['mySlider']).toBeDefined();
    });

    it('should wire gadgets together', () => {
      const bassline = withTaps(basslineGadget({
        factories: {
          max: maxCell,
          last: lastCell
        }
      }));

      // Create two gadgets
      bassline.receive({ create: { id: 'source', type: 'last', args: [5] } });
      bassline.receive({ create: { id: 'target', type: 'max', args: [0] } });

      let wiredEvent: any;
      bassline.tap(({ wired }) => {
        if (wired) wiredEvent = wired;
      });

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

      expect(wiredEvent).toEqual({ id: 'connection1', from: 'source', to: 'target' });

      // Verify connection exists
      const connections = bassline.current().connections.current();
      expect(connections['connection1']).toBeDefined();
      expect(connections['connection1'].from).toBe('source');
      expect(connections['connection1'].to).toBe('target');

      // Test that wiring actually works
      const registry = bassline.current().registry.current();
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

      // Verify connection works
      const registry = bassline.current().registry.current();
      const source = registry['source'] as any;
      const target = registry['target'] as any;

      source.receive(10);
      expect(target.current()).toBe(10);

      // Disconnect
      let disconnectedEvent: any;
      bassline.tap(({ disconnected }) => {
        if (disconnected) disconnectedEvent = disconnected;
      });

      bassline.receive({ disconnect: 'conn1' });
      expect(disconnectedEvent).toEqual({ id: 'conn1' });

      // Verify connection no longer works
      source.receive(20);
      expect(target.current()).toBe(10); // Should still be 10
    });

    it('should register new factories dynamically', () => {
      const bassline = withTaps(basslineGadget());

      let registeredEvent: any;
      bassline.tap(({ factoryRegistered }) => {
        if (factoryRegistered) registeredEvent = factoryRegistered;
      });

      // Register a factory
      bassline.receive({
        registerFactory: {
          name: 'myCell',
          factory: (init: number) => lastCell(init)
        }
      });

      expect(registeredEvent).toEqual({ name: 'myCell' });

      // Use the registered factory
      bassline.receive({ create: { id: 'test', type: 'myCell', args: [42] } });

      const registry = bassline.current().registry.current();
      expect(registry['test']).toBeDefined();
      expect(registry['test'].current()).toBe(42);
    });

    it('should destroy gadget instances and their connections', () => {
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

      // Destroy gadget 'a'
      let destroyedEvent: any;
      bassline.tap(({ destroyed }) => {
        if (destroyed) destroyedEvent = destroyed;
      });

      bassline.receive({ destroy: 'a' });
      expect(destroyedEvent).toEqual({ id: 'a' });

      // Verify 'a' is gone from registry
      const registry = bassline.current().registry.current();
      expect(registry['a']).toBeUndefined();
      expect(registry['b']).toBeDefined();
      expect(registry['c']).toBeDefined();

      // Verify connections involving 'a' are gone
      const connections = bassline.current().connections.current();
      expect(connections['conn1']).toBeUndefined();
      expect(connections['conn2']).toBeUndefined();
    });

    it('should emit notFound effects for invalid operations', () => {
      const bassline = withTaps(basslineGadget());

      let notFoundEvent: any;
      bassline.tap(({ notFound }) => {
        if (notFound) notFoundEvent = notFound;
      });

      // Try to create with unknown type
      bassline.receive({ create: { id: 'test', type: 'unknown', args: [] } });
      expect(notFoundEvent).toEqual({ type: 'unknown' });

      // Try to wire non-existent gadgets
      bassline.receive({
        wire: {
          id: 'conn',
          from: 'missing',
          to: 'alsoMissing'
        }
      });
      expect(notFoundEvent).toEqual({ instance: 'missing' });
    });
  });

  describe('bassline composition', () => {
    it('should compose basslines by merging factories', () => {
      // Create UI bassline with UI gadgets
      const uiBassline = withTaps(basslineGadget({
        factories: {
          slider: sliderGadget
        }
      }));

      // Create data bassline with data gadgets
      const dataBassline = withTaps(basslineGadget({
        factories: {
          max: maxCell,
          last: lastCell
        }
      }));

      // Create composed bassline
      const composedBassline = withTaps(basslineGadget());

      // Copy initial factories from UI bassline
      const uiFactories = uiBassline.current().namespace.current();
      Object.entries(uiFactories).forEach(([name, factory]) => {
        composedBassline.receive({
          registerFactory: { name, factory }
        });
      });

      // Copy initial factories from data bassline
      const dataFactories = dataBassline.current().namespace.current();
      Object.entries(dataFactories).forEach(([name, factory]) => {
        composedBassline.receive({
          registerFactory: { name, factory }
        });
      });

      // Wire future changes
      uiBassline.current().namespace.tap(({ changed }) => {
        if (changed) {
          Object.entries(changed).forEach(([name, factory]) => {
            composedBassline.receive({
              registerFactory: { name, factory }
            });
          });
        }
      });

      dataBassline.current().namespace.tap(({ changed }) => {
        if (changed) {
          Object.entries(changed).forEach(([name, factory]) => {
            composedBassline.receive({
              registerFactory: { name, factory }
            });
          });
        }
      });

      // Now composed bassline should have all factories
      const namespace = composedBassline.current().namespace.current();
      expect(namespace['slider']).toBeDefined();
      expect(namespace['max']).toBeDefined();
      expect(namespace['last']).toBeDefined();

      // Test that we can create gadgets from both vocabularies
      composedBassline.receive({
        create: { id: 'ui1', type: 'slider', args: [50, 0, 100, 1] }
      });
      composedBassline.receive({
        create: { id: 'data1', type: 'max', args: [10] }
      });

      const registry = composedBassline.current().registry.current();
      expect(registry['ui1']).toBeDefined();
      expect(registry['data1']).toBeDefined();
    });

    it('should allow basslines to observe each other', () => {
      const bassline1 = withTaps(basslineGadget({
        factories: { last: lastCell }
      }));

      const bassline2 = withTaps(basslineGadget());

      const events: any[] = [];

      // Bassline2 observes bassline1's creations
      bassline1.tap(({ created }) => {
        if (created) {
          events.push({ from: 'bassline1', event: 'created', ...created });
          // Mirror the creation in bassline2
          bassline2.receive({
            registerFactory: { name: 'last', factory: lastCell }
          });
          bassline2.receive({
            create: { id: `mirror-${created.id}`, type: created.type, args: [0] }
          });
        }
      });

      // Create something in bassline1
      bassline1.receive({ create: { id: 'gadget1', type: 'last', args: [42] } });

      // Check events
      expect(events).toContainEqual({
        from: 'bassline1',
        event: 'created',
        id: 'gadget1',
        type: 'last'
      });

      // Check that bassline2 mirrored it
      const registry2 = bassline2.current().registry.current();
      expect(registry2['mirror-gadget1']).toBeDefined();
    });

    it('should enable derived basslines with custom patterns', () => {
      // Base bassline
      const base = withTaps(basslineGadget({
        factories: {
          max: maxCell,
          last: lastCell
        }
      }));

      // Derived bassline adds new patterns
      const derived = withTaps(basslineGadget({
        patterns: {
          bidirectional: (a: any, b: any) => {
            const c1 = a.tap(({ changed }: any) => {
              if (changed !== undefined) b.receive(changed);
            });
            const c2 = b.tap(({ changed }: any) => {
              if (changed !== undefined) a.receive(changed);
            });
            return { cleanup: () => { c1(); c2(); } };
          }
        }
      }));

      // Copy initial factories from base
      const baseFactories = base.current().namespace.current();
      Object.entries(baseFactories).forEach(([name, factory]) => {
        derived.receive({ registerFactory: { name, factory } });
      });

      // Wire future changes
      base.current().namespace.tap(({ changed }) => {
        if (changed) {
          Object.entries(changed).forEach(([name, factory]) => {
            derived.receive({ registerFactory: { name, factory } });
          });
        }
      });

      // Create gadgets in derived
      derived.receive({ create: { id: 'g1', type: 'max', args: [10] } });
      derived.receive({ create: { id: 'g2', type: 'max', args: [10] } });

      // Wire with custom pattern
      derived.receive({
        wire: {
          id: 'biconn',
          from: 'g1',
          to: 'g2',
          pattern: 'bidirectional'
        }
      });

      // Test bidirectional wiring
      const registry = derived.current().registry.current();
      const g1 = registry['g1'] as any;
      const g2 = registry['g2'] as any;

      g1.receive(20);
      expect(g2.current()).toBe(20);

      g2.receive(30);
      expect(g1.current()).toBe(30);
    });
  });
});