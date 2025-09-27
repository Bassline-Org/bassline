import { describe, it, expect } from 'vitest';
import { basslineGadget } from './bassline3';
import { withTaps } from '../core/typed';
import { maxCell, lastCell } from '../patterns/cells/typed-cells';
import { sliderGadget } from '../patterns/ui/typed-ui';

describe('Bassline3 - Clean Architecture', () => {
  describe('basic operations', () => {
    it('should create gadget instances', () => {
      const bassline = basslineGadget({
        factories: {
          max: maxCell,
          last: lastCell
        }
      });

      bassline.create('myMax', 'max', [10]);

      const instances = bassline.instances.current();
      expect(instances['myMax']).toBeDefined();
      expect(instances['myMax'].current()).toBe(10);
    });

    it('should wire gadgets together', () => {
      const bassline = basslineGadget({
        factories: {
          last: lastCell,
          max: maxCell
        }
      });

      bassline.create('source', 'last', [5]);
      bassline.create('target', 'max', [0]);
      bassline.wire('link1', 'source', 'target');

      // Check edge exists in topology
      const edges = bassline.edges.current();
      expect(edges['link1']).toEqual({
        from: 'source',
        to: 'target'
      });

      // Test actual wiring works
      const instances = bassline.instances.current();
      const source = instances['source'] as any;
      const target = instances['target'] as any;

      source.receive(20);
      expect(target.current()).toBe(20);
    });

    it('should wire with custom field extraction', () => {
      const bassline = basslineGadget({
        factories: {
          last: lastCell,
          max: maxCell
        }
      });

      bassline.create('a', 'last', [5]);
      bassline.create('b', 'max', [0]);

      // Wire with custom field
      bassline.wire('link', 'a', 'b', { field: 'changed' });

      const instances = bassline.instances.current();
      const a = instances['a'] as any;
      const b = instances['b'] as any;

      a.receive(15);
      expect(b.current()).toBe(15);
    });

    it('should wire with transform function', () => {
      const bassline = basslineGadget({
        factories: {
          last: lastCell,
          max: maxCell
        }
      });

      bassline.create('a', 'last', [10]);
      bassline.create('b', 'max', [0]);

      // Wire with transform
      bassline.wire('link', 'a', 'b', {
        field: 'changed',
        transform: (x: number) => x * 2
      });

      const instances = bassline.instances.current();
      const a = instances['a'] as any;
      const b = instances['b'] as any;

      a.receive(5);
      expect(b.current()).toBe(10); // 5 * 2
    });

    it('should disconnect edges', () => {
      const bassline = basslineGadget({
        factories: {
          last: lastCell,
          max: maxCell
        }
      });

      bassline.create('a', 'last', [5]);
      bassline.create('b', 'max', [0]);
      bassline.wire('link', 'a', 'b');

      const instances = bassline.instances.current();
      const a = instances['a'] as any;
      const b = instances['b'] as any;

      // Verify wiring works
      a.receive(10);
      expect(b.current()).toBe(10);

      // Disconnect
      bassline.disconnect('link');

      // Verify edge removed from topology
      const edges = bassline.edges.current();
      expect(edges['link']).toBeUndefined();

      // Verify wiring no longer works
      a.receive(20);
      expect(b.current()).toBe(10); // Still 10
    });

    it('should destroy instances and clean up edges', () => {
      const bassline = basslineGadget({
        factories: {
          last: lastCell,
          max: maxCell
        }
      });

      bassline.create('hub', 'last', [1]);
      bassline.create('spoke1', 'max', [0]);
      bassline.create('spoke2', 'max', [0]);

      bassline.wire('edge1', 'hub', 'spoke1');
      bassline.wire('edge2', 'hub', 'spoke2');

      // Verify edges exist
      let edges = bassline.edges.current();
      expect(edges['edge1']).toBeDefined();
      expect(edges['edge2']).toBeDefined();

      // Destroy hub
      bassline.destroy('hub');

      // Verify instance removed
      const instances = bassline.instances.current();
      expect(instances['hub']).toBeUndefined();
      expect(instances['spoke1']).toBeDefined();
      expect(instances['spoke2']).toBeDefined();

      // Verify edges involving hub are removed
      edges = bassline.edges.current();
      expect(edges['edge1']).toBeUndefined();
      expect(edges['edge2']).toBeUndefined();
    });
  });

  describe('orthogonality', () => {
    it('should allow observing table changes independently', () => {
      const bassline = basslineGadget();

      const definitionChanges: any[] = [];
      const edgeChanges: any[] = [];

      // Observe definition changes
      bassline.definitions.tap(({ added }) => {
        if (added) definitionChanges.push(added);
      });

      // Observe edge changes
      bassline.edges.tap(({ added }) => {
        if (added) edgeChanges.push(added);
      });

      // Add a factory
      bassline.definitions.receive({ test: lastCell });

      // Add an edge
      bassline.edges.receive({
        edge1: { from: 'x', to: 'y' }
      });

      expect(definitionChanges.length).toBe(1);
      expect(definitionChanges[0]).toHaveProperty('test');
      expect(edgeChanges.length).toBe(1);
      expect(edgeChanges[0]).toHaveProperty('edge1');
    });

    it('should keep edge data pure', () => {
      const bassline = basslineGadget();

      // Add edge with arbitrary metadata
      bassline.edges.receive({
        myEdge: {
          from: 'a',
          to: 'b',
          field: 'computed',
          transform: (x: number) => x + 1,
          customData: 'whatever',
          priority: 5
        }
      });

      const edges = bassline.edges.current();
      const edge = edges['myEdge'];

      // Edge should store all the data
      expect(edge.from).toBe('a');
      expect(edge.to).toBe('b');
      expect(edge.field).toBe('computed');
      expect(edge.transform).toBeDefined();
      expect(edge.customData).toBe('whatever');
      expect(edge.priority).toBe(5);
    });

    it('should allow swapping table implementations', () => {
      // You could use ANY gadget as the edges table
      const customEdges = withTaps(lastCell({}));

      // Create bassline with custom edges table
      const bassline = basslineGadget();

      // Replace edges with custom implementation
      // (In real usage, you'd pass custom tables to the constructor)
      const customBassline = {
        ...bassline,
        edges: customEdges as any
      };

      // Should still work
      customBassline.edges.receive({
        edge1: { from: 'x', to: 'y' }
      });

      const edges = customBassline.edges.current();
      expect(edges).toHaveProperty('edge1');
    });
  });
});