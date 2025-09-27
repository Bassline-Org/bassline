import { describe, it, expect } from 'vitest';
import { bassline, basslineGadget } from './bassline4';
import { withTaps } from '../core/typed';
import { maxCell, lastCell } from '../patterns/cells/typed-cells';
import { sliderGadget } from '../patterns/ui/typed-ui';
import { lastTable, firstTable } from '../patterns/cells/tables';

describe('Bassline4 - Generic Architecture', () => {
  describe('basslineGadget convenience function', () => {
    it('should work exactly like bassline3', () => {
      const system = basslineGadget({
        factories: {
          max: maxCell,
          last: lastCell
        }
      });

      system.create('a', 'max', [10]);
      system.create('b', 'last', [5]);
      system.wire('link', 'a', 'b');

      const instances = system.instances.current();
      const a = instances['a'] as any;
      const b = instances['b'] as any;

      a.receive(20);
      expect(b.current()).toBe(20);
    });
  });

  describe('generic bassline with different table types', () => {
    it('should work with firstTable for instances', () => {
      const system = bassline({
        definitions: withTaps(lastTable<string, Function>({ last: lastCell })),
        instances: withTaps(firstTable<string, any>({})), // Different table type!
        edges: withTaps(lastTable<string, any>({})),
        patterns: withTaps(lastTable<string, Function>({}))
      });

      system.create('gadget1', 'last', [42]);
      system.create('gadget1', 'last', [99]); // firstTable should ignore this

      const instances = system.instances.current();
      expect(instances['gadget1'].current()).toBe(42); // Should be first value, not 99
    });

    it('should work with different table implementations', () => {
      // Use firstTable for edges - once an edge is set, updates are ignored
      const customEdges = withTaps(firstTable<string, any>({}));

      const system = bassline({
        definitions: withTaps(lastTable<string, Function>({ last: lastCell })),
        instances: withTaps(lastTable<string, any>({})),
        edges: customEdges, // Custom edge storage!
        patterns: withTaps(lastTable<string, Function>({}))
      });

      system.create('a', 'last', [1]);
      system.create('b', 'last', [2]);

      // This should work even with the custom edges table
      system.wire('edge1', 'a', 'b');

      const instances = system.instances.current();
      const a = instances['a'] as any;
      const b = instances['b'] as any;

      a.receive(10);
      expect(b.current()).toBe(10);
    });

    it('should work with custom gadgets for any role', () => {
      // Custom definitions storage that tracks registration events
      const events: string[] = [];
      const customDefinitions = withTaps(lastTable<string, Function>({}));
      customDefinitions.tap(({ added }) => {
        if (added) {
          for (const name of Object.keys(added)) {
            events.push(`registered: ${name}`);
          }
        }
      });

      const system = bassline({
        definitions: customDefinitions,
        instances: withTaps(lastTable<string, any>({})),
        edges: withTaps(lastTable<string, any>({})),
        patterns: withTaps(lastTable<string, Function>({}))
      });

      // Add a factory
      system.definitions.receive({ test: lastCell });
      expect(events).toContain('registered: test');

      // Should still work for creation
      system.create('instance1', 'test', [123]);
      const instances = system.instances.current();
      expect(instances['instance1'].current()).toBe(123);
    });
  });

  describe('type safety and flexibility', () => {
    it('should enforce role constraints at compile time', () => {
      // This should compile - lastTable fits DefinitionsRole
      const validDefinitions = withTaps(lastTable<string, Function>({}));

      // This should compile - lastTable fits InstancesRole
      const validInstances = withTaps(lastTable<string, any>({}));

      const system = bassline({
        definitions: validDefinitions,
        instances: validInstances,
        edges: withTaps(lastTable<string, any>({})),
        patterns: withTaps(lastTable<string, Function>({}))
      });

      expect(system).toBeDefined();
    });

    it('should work with arbitrary edge metadata', () => {
      const system = basslineGadget({
        factories: { last: lastCell, max: maxCell }
      });

      system.create('a', 'last', [5]);
      system.create('b', 'max', [0]);

      // Add edge with custom metadata
      system.wire('link', 'a', 'b', {
        field: 'changed',
        transform: (x: number) => x * 3,
        priority: 'high',
        customData: { author: 'test', timestamp: Date.now() }
      });

      // Verify the edge data is stored
      const edges = system.edges.current();
      const edge = edges['link'];
      expect(edge.from).toBe('a');
      expect(edge.to).toBe('b');
      expect(edge.priority).toBe('high');
      expect(edge.customData.author).toBe('test');

      // Verify the wiring actually works
      const instances = system.instances.current();
      const a = instances['a'] as any;
      const b = instances['b'] as any;

      a.receive(4);
      expect(b.current()).toBe(12); // 4 * 3
    });

    it('should enable composition of basslines', () => {
      // Create two separate basslines
      const uiSystem = basslineGadget({
        factories: { slider: sliderGadget }
      });

      const dataSystem = basslineGadget({
        factories: { max: maxCell, last: lastCell }
      });

      // Create a meta-bassline that observes both
      const metaSystem = basslineGadget();

      // Copy initial factories from both systems
      const uiFactories = uiSystem.definitions.current();
      metaSystem.definitions.receive(uiFactories);

      const dataFactories = dataSystem.definitions.current();
      metaSystem.definitions.receive(dataFactories);

      // Wire future changes from both systems to meta system
      uiSystem.definitions.tap((effects: any) => {
        if (effects.added) {
          metaSystem.definitions.receive(effects.added);
        }
      });

      dataSystem.definitions.tap((effects: any) => {
        if (effects.added) {
          metaSystem.definitions.receive(effects.added);
        }
      });

      // Meta system should now have all factories
      const namespace = metaSystem.definitions.current();
      expect(namespace).toHaveProperty('slider');
      expect(namespace).toHaveProperty('max');
      expect(namespace).toHaveProperty('last');

      // Should be able to create from both vocabularies
      metaSystem.create('ui1', 'slider', [50, 0, 100, 1]);
      metaSystem.create('data1', 'max', [10]);

      const instances = metaSystem.instances.current();
      expect(instances['ui1']).toBeDefined();
      expect(instances['data1']).toBeDefined();
      expect(instances['data1'].current()).toBe(10);
    });
  });

  describe('role orthogonality', () => {
    it('should allow swapping any role independently', () => {
      // Start with standard configuration
      const standardDefs = withTaps(lastTable<string, Function>({ test: lastCell }));
      const standardInsts = withTaps(lastTable<string, any>({}));
      const standardEdges = withTaps(lastTable<string, any>({}));
      const standardPatterns = withTaps(lastTable<string, Function>({}));

      let system = bassline({
        definitions: standardDefs,
        instances: standardInsts,
        edges: standardEdges,
        patterns: standardPatterns
      });

      // Create and verify basic functionality
      system.create('test1', 'test', [42]);
      expect(system.instances.current()['test1'].current()).toBe(42);

      // Now swap just the instances table for a different implementation
      const newInstances = withTaps(firstTable<string, any>({}));
      system = bassline({
        definitions: standardDefs,    // Keep same
        instances: newInstances,      // Swap this
        edges: standardEdges,         // Keep same
        patterns: standardPatterns    // Keep same
      });

      // Should still work, but with different semantics
      system.create('test2', 'test', [100]);
      system.create('test2', 'test', [200]); // firstTable ignores updates

      expect(system.instances.current()['test2'].current()).toBe(100);
    });
  });
});