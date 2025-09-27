import { describe, it, expect } from 'vitest';
import { factoryBassline } from './factoryBassline';
import { maxCell, lastCell } from '../patterns/cells';
import { withTaps } from '../core/typed';

describe('factoryBassline', () => {
  describe('type management', () => {
    it('should define types and emit typeAdded', () => {
      const bassline = withTaps(factoryBassline());
      let emitted: any;

      bassline.tap(e => emitted = e);
      bassline.receive({ defineType: { name: 'max', factory: maxCell } });

      expect(emitted).toEqual({ typeAdded: { name: 'max', factory: maxCell } });
      expect(bassline.current().types['max']).toBe(maxCell);
    });

    it('should emit alreadyExists for duplicate types', () => {
      const bassline = withTaps(factoryBassline());
      let emitted: any;

      bassline.receive({ defineType: { name: 'max', factory: maxCell } });
      bassline.tap(e => emitted = e);
      bassline.receive({ defineType: { name: 'max', factory: lastCell } });

      expect(emitted).toEqual({ alreadyExists: { name: 'max', kind: 'type' } });
    });
  });

  describe('instance spawning', () => {
    it('should spawn instances and emit spawned', () => {
      const bassline = withTaps(factoryBassline({ max: maxCell }));
      let emitted: any;

      bassline.tap(e => emitted = e);
      bassline.receive({ spawn: { name: 'sensor', type: 'max', args: [10] } });

      expect(emitted.spawned).toMatchObject({ name: 'sensor', type: 'max' });
      expect(bassline.current().instances['sensor']).toBeDefined();
      expect(bassline.current().instances['sensor'].current()).toBe(10);
    });

    it('should emit unknownType with available types', () => {
      const bassline = withTaps(factoryBassline({ max: maxCell, last: lastCell }));
      let emitted: any;

      bassline.tap(e => emitted = e);
      bassline.receive({ spawn: { name: 'x', type: 'unknown' } });

      expect(emitted).toEqual({
        unknownType: {
          type: 'unknown',
          availableTypes: ['max', 'last']
        }
      });
    });

    it('should emit alreadyExists for duplicate instances', () => {
      const bassline = withTaps(factoryBassline({ max: maxCell }));
      let emitted: any;

      bassline.receive({ spawn: { name: 'a', type: 'max' } });
      bassline.tap(e => emitted = e);
      bassline.receive({ spawn: { name: 'a', type: 'max' } });

      expect(emitted).toEqual({ alreadyExists: { name: 'a', kind: 'instance' } });
    });
  });

  describe('connections', () => {
    it('should connect instances using built-in patterns', () => {
      const bassline = withTaps(factoryBassline({ max: maxCell }));
      let emitted: any;

      bassline.receive({ spawn: { name: 'a', type: 'max', args: [0] } });
      bassline.receive({ spawn: { name: 'b', type: 'max', args: [0] } });

      bassline.tap(e => emitted = e);
      bassline.receive({ connect: { id: 'link', from: 'a', to: 'b' } });

      expect(emitted).toEqual({ connected: { id: 'link', from: 'a', to: 'b', pattern: 'extract' } });
      expect(bassline.current().connections['link']).toBeDefined();

      // Test that connection actually works
      const a = bassline.current().instances['a'];
      const b = bassline.current().instances['b'];
      a.receive(5);
      expect(b.current()).toBe(5);
    });

    it('should emit unknownInstance with available instances', () => {
      const bassline = withTaps(factoryBassline({ max: maxCell }));
      let emitted: any;

      bassline.receive({ spawn: { name: 'a', type: 'max' } });
      bassline.receive({ spawn: { name: 'b', type: 'max' } });

      bassline.tap(e => emitted = e);
      bassline.receive({ connect: { id: 'c1', from: 'missing', to: 'b' } });

      expect(emitted).toEqual({
        unknownInstance: {
          instance: 'missing',
          availableInstances: ['a', 'b'],
          context: 'connection'
        }
      });
    });

    it('should emit unknownPattern with available patterns', () => {
      const bassline = withTaps(factoryBassline({ max: maxCell }));
      let emitted: any;

      bassline.receive({ spawn: { name: 'a', type: 'max' } });
      bassline.receive({ spawn: { name: 'b', type: 'max' } });

      bassline.tap(e => emitted = e);
      bassline.receive({ connect: { id: 'c1', from: 'a', to: 'b', pattern: 'custom' } });

      expect(emitted).toEqual({
        unknownPattern: {
          pattern: 'custom',
          availablePatterns: ['extract', 'transform', 'forward']
        }
      });
    });

    it('should use custom patterns', () => {
      const bassline = withTaps(factoryBassline({ max: maxCell }));

      // Define a custom pattern
      bassline.receive({
        definePattern: {
          name: 'double',
          pattern: (from: any, to: any) => {
            const cleanup = from.tap((e: any) => {
              if ('changed' in e && e.changed !== undefined) {
                to.receive(e.changed * 2);
              }
            });
            return { cleanup };
          }
        }
      });

      bassline.receive({ spawn: { name: 'a', type: 'max', args: [0] } });
      bassline.receive({ spawn: { name: 'b', type: 'max', args: [0] } });
      bassline.receive({ connect: { id: 'c1', from: 'a', to: 'b', pattern: 'double' } });

      const a = bassline.current().instances['a'];
      const b = bassline.current().instances['b'];
      a.receive(5);
      expect(b.current()).toBe(10); // Doubled
    });
  });

  describe('disconnection and destruction', () => {
    it('should disconnect connections', () => {
      const bassline = withTaps(factoryBassline({ max: maxCell }));

      bassline.receive({ spawn: { name: 'a', type: 'max', args: [0] } });
      bassline.receive({ spawn: { name: 'b', type: 'max', args: [0] } });
      bassline.receive({ connect: { id: 'link', from: 'a', to: 'b' } });

      const a = bassline.current().instances['a'];
      const b = bassline.current().instances['b'];

      // Connection works
      a.receive(5);
      expect(b.current()).toBe(5);

      // Disconnect
      bassline.receive({ disconnect: 'link' });
      expect(bassline.current().connections['link']).toBeUndefined();

      // Connection no longer works
      a.receive(10);
      expect(b.current()).toBe(5); // Still 5
    });

    it('should destroy instances and their connections', () => {
      const bassline = withTaps(factoryBassline({ max: maxCell }));

      bassline.receive({ spawn: { name: 'a', type: 'max', args: [0] } });
      bassline.receive({ spawn: { name: 'b', type: 'max', args: [0] } });
      bassline.receive({ spawn: { name: 'c', type: 'max', args: [0] } });

      bassline.receive({ connect: { id: 'c1', from: 'a', to: 'b' } });
      bassline.receive({ connect: { id: 'c2', from: 'b', to: 'c' } });

      expect(Object.keys(bassline.current().connections)).toHaveLength(2);

      // Destroy b - should clean up both connections
      bassline.receive({ destroy: 'b' });

      expect(bassline.current().instances['b']).toBeUndefined();
      expect(Object.keys(bassline.current().connections)).toHaveLength(0);
    });
  });

  describe('error effects as partial information', () => {
    it('errors can be used by other gadgets to provide missing types', () => {
      const bassline = withTaps(factoryBassline());
      const typeProvider = withTaps(factoryBassline({ max: maxCell, last: lastCell }));

      // Wire unknownType effects to type provider
      bassline.tap(({ unknownType }) => {
        if (unknownType) {
          // Type provider could look up and provide the missing type
          const factory = typeProvider.current().types[unknownType.type];
          if (factory) {
            bassline.receive({ defineType: { name: unknownType.type, factory } });
          }
        }
      });

      // Try to spawn unknown type
      bassline.receive({ spawn: { name: 'x', type: 'max' } });

      // Should now have the type
      expect(bassline.current().types['max']).toBeDefined();

      // Can now spawn successfully
      bassline.receive({ spawn: { name: 'x', type: 'max', args: [42] } });
      expect(bassline.current().instances['x'].current()).toBe(42);
    });

    it('errors provide actionable information for recovery', () => {
      const bassline = withTaps(factoryBassline({ max: maxCell }));
      const errors: any[] = [];

      bassline.tap(e => {
        if ('unknownType' in e || 'unknownInstance' in e || 'unknownPattern' in e) {
          errors.push(e);
        }
      });

      bassline.receive({ spawn: { name: 'a', type: 'missing' } });
      bassline.receive({ spawn: { name: 'b', type: 'max' } });
      bassline.receive({ connect: { id: 'c', from: 'missing', to: 'b' } });

      // Each error has context for recovery
      expect(errors[0].unknownType.availableTypes).toEqual(['max']);
      expect(errors[1].unknownInstance.availableInstances).toEqual(['b']);
      expect(errors[1].unknownInstance.context).toBe('connection');
    });
  });
});