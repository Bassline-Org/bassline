import { describe, it, expect } from 'vitest';
import { Actions, defGadget, Effects, Input, State, withTaps } from '../core/typed';
import { maxCell, lastCell } from '../patterns/cells/typed-cells';
import { fn } from '../patterns/functions/typed-functions';
import { extract, transform, combine, relations, combiner } from './index';

describe('Relations', () => {
  describe('extract', () => {
    it('should extract changed field and forward to target', () => {
      const source = withTaps(maxCell(5));
      const target = withTaps(maxCell(0));

      const { cleanup } = extract(source, 'changed', target);

      // Trigger a change
      source.receive(10);
      expect(target.current()).toBe(10);

      // Smaller value shouldn't change (maxCell behavior)
      source.receive(3);
      expect(target.current()).toBe(10);

      // Larger value should propagate
      source.receive(15);
      expect(target.current()).toBe(15);

      cleanup();
    });

    it('should not forward undefined values', () => {
      const source = withTaps(lastCell(5));
      const target = withTaps(lastCell(0));

      const { cleanup } = extract(source, 'noop', target);

      // This emits {changed: 10}, not {noop: ...}
      source.receive(10);
      expect(target.current()).toBe(0); // No change

      cleanup();
    });
  });

  describe('transform', () => {
    it('should transform values before sending', () => {
      const source = withTaps(maxCell(5));
      const target = withTaps(lastCell(0));

      const { cleanup } = transform(source, 'changed', x => x * 2, target);

      source.receive(10);
      expect(target.current()).toBe(20);

      source.receive(15);
      expect(target.current()).toBe(30);

      cleanup();
    });

    it('should not send when transform returns undefined', () => {
      const source = withTaps(lastCell(5));
      const target = withTaps(lastCell(0));

      const { cleanup } = transform(
        source,
        'changed',
        x => x > 10 ? x : undefined,
        target
      );

      source.receive(5);
      expect(target.current()).toBe(0); // Not sent

      source.receive(15);
      expect(target.current()).toBe(15); // Sent

      cleanup();
    });
  });

  describe('combine', () => {
    it('should wire multiple sources to fn gadget', () => {
      const a = withTaps(lastCell(2));
      const b = withTaps(lastCell(123));

      const sum = withTaps(fn(
        ({ x, y }: { x: number; y: number }) => x + y,
        ['x', 'y']
      )({ x: 2, y: 3 }));  // Provide initial values

      const { cleanup } = combiner(sum)
        .wire('x', a)
        .wire('y', b)
        .build();
      // Initial values should compute
      expect(sum.current().result).toBe(5);

      // Update a
      a.receive(10);
      expect(sum.current().result).toBe(13);

      // Update b
      b.receive(7);
      expect(sum.current().result).toBe(17);

      cleanup();
    });

    it('should support explicit field selection', () => {
      const a = withTaps(lastCell(2));
      const b = withTaps(lastCell(3));

      // Create a custom gadget that emits 'computed' effect
      type CustomGadgetSpec = State<number> & Effects<{ changed: number, computed: number }> & Input<number> & Actions<{ computed: number }>;
      const customGadgetBase = defGadget<CustomGadgetSpec>({
        dispatch: (_state, input) => ({ computed: input }),
        methods: {
          computed: (gadget, value) => ({ changed: 7, computed: 7 })
        }
      });
      const customGadget = withTaps(customGadgetBase(7));

      const sum = withTaps(fn(
        ({ x, y, z }: { x: number; y: number; z: number }) => x + y + Number(z),
        ['x', 'y', 'z']
      )({ x: 2, y: 3, z: 7 }));  // Provide initial values

      const { cleanup } = combiner(sum)
        .wire('x', a)
        .wire('y', b)
        .wire('z', customGadget)
        .build();

      // Let the mock effect propagate
      return new Promise<void>(resolve => {
        setTimeout(() => {
          expect(sum.current().result).toBe(12); // 2 + 3 + 7
          cleanup();
          resolve();
        }, 10);
      });
    });
  });

  describe('relations', () => {
    it('should wire multiple relations with single cleanup', () => {
      const a = withTaps(maxCell(0));
      const b = withTaps(maxCell(0));
      const c = withTaps(maxCell(0));

      const flow = relations([
        () => extract(a, 'changed', b),
        () => transform(b, 'changed', x => x * 2, c)
      ]);

      a.receive(5);
      expect(b.current()).toBe(5);
      expect(c.current()).toBe(10);

      a.receive(10);
      expect(b.current()).toBe(10);
      expect(c.current()).toBe(20);

      // Cleanup should disconnect everything
      flow.cleanup();

      a.receive(15);
      expect(b.current()).toBe(10); // No longer connected
      expect(c.current()).toBe(20); // No longer connected
    });
  });

  describe('combiner builder', () => {
    it('should wire gadgets with fluent API', () => {
      const a = withTaps(lastCell(2));
      const b = withTaps(lastCell(3));

      const sum = withTaps(fn(
        ({ x, y }: { x: number; y: number }) => x + y,
        ['x', 'y']
      )({ x: 2, y: 3 }));

      const { cleanup } = combiner(sum)
        .wire('x', a)
        .wire('y', b)
        .build();

      expect(sum.current().result).toBe(5);

      a.receive(10);
      expect(sum.current().result).toBe(13);

      b.receive(7);
      expect(sum.current().result).toBe(17);

      cleanup();
    });

    it('should support field extraction', () => {
      const a = withTaps(lastCell(2));

      // Create a gadget that emits a custom field
      const customGadget = {
        current: () => 7,
        update: () => { },
        receive: () => { },
        emit: () => { },
        tap: (fn: (effect: unknown) => void) => {
          setTimeout(() => fn({ computed: 10 }), 0);
          return () => { };
        }
      };

      const sum = withTaps(fn(
        ({ x, y }: { x: number; y: number }) => x + y,
        ['x', 'y']
      )({ x: 2, y: 10 }));

      const { cleanup } = combiner(sum)
        .wire('x', a)
        .wire('y', customGadget as any, 'computed')
        .build();

      return new Promise<void>(resolve => {
        setTimeout(() => {
          expect(sum.current().result).toBe(12); // 2 + 10
          cleanup();
          resolve();
        }, 10);
      });
    });

    it('should support transformation', () => {
      const a = withTaps(lastCell(5));
      const b = withTaps(lastCell(3));

      const sum = withTaps(fn(
        ({ x, y }: { x: number; y: number }) => x + y,
        ['x', 'y']
      )({ x: 10, y: 3 }));

      const { cleanup } = combiner(sum)
        .wire('x', a, 'changed', (x) => typeof x === 'number' ? x * 2 : undefined)  // Transform x by doubling
        .wire('y', b)
        .build();

      expect(sum.current().result).toBe(13); // (5 * 2) + 3

      a.receive(10);
      expect(sum.current().result).toBe(23); // (10 * 2) + 3

      cleanup();
    });

    it('should throw error on duplicate wiring', () => {
      const a = withTaps(lastCell(2));
      const b = withTaps(lastCell(3));

      const sum = withTaps(fn(
        ({ x, y }: { x: number; y: number }) => x + y,
        ['x', 'y']
      )({ x: 2, y: 3 }));

      expect(() => {
        combiner(sum)
          .wire('x', a)
          .wire('x' as 'y', b)  // Should throw at runtime, cast to bypass compile check
          .build();
      }).toThrow('Key "x" is already wired');
    });
  });
});