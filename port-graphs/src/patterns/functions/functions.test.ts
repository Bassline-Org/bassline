import { describe, it, expect } from 'vitest';
import { quick, withTaps } from '../../core/context';
import { transformProto, partialProto, fallibleProto } from './protos';

describe('Function Gadgets', () => {
  describe('transformProto - Simple Transformations', () => {
    it('should transform input to output immediately', () => {
      const double = quick(transformProto((x: number) => x * 2), 1);

      double.receive(5);
      expect(double.current()).toBe(10);

      double.receive(7);
      expect(double.current()).toBe(14);
    });

    it('should emit computed effects', () => {
      const square = withTaps(quick(transformProto((x: number) => x * x), 1));

      const emissions: any[] = [];
      square.tap(e => emissions.push(e));

      square.receive(4);

      expect(emissions).toHaveLength(1);
      expect(emissions[0]).toEqual({ computed: 16 });
    });

    it('should work with string transformations', () => {
      const upper = quick(transformProto((s: string) => s.toUpperCase()), 'hello');

      upper.receive('hello');
      expect(upper.current()).toBe('HELLO');
    });

    it('should cache the last result in state', () => {
      const increment = quick(transformProto((x: number) => x + 1), 1);

      increment.receive(5);
      expect(increment.current()).toBe(6);

      increment.receive(10);
      expect(increment.current()).toBe(11);
    });
  });

  describe('partialProto - Partial Function Application', () => {
    it('should accumulate arguments until all present', () => {
      type Args = { x: number; y: number };
      const add = quick(
        partialProto((args: Args) => args.x + args.y, ['x', 'y']),
        {}
      );

      add.receive({ x: 5 });
      expect(add.current()).toEqual({ x: 5 });

      add.receive({ y: 3 });
      expect(add.current()).toEqual({ x: 5, y: 3 });
    });

    it('should emit computed effect only when ready', () => {
      type Args = { x: number; y: number };
      const multiply = withTaps(quick(
        partialProto((args: Args) => args.x * args.y, ['x', 'y']),
        {}
      ));

      const emissions: any[] = [];
      multiply.tap(e => emissions.push(e));

      multiply.receive({ x: 3 });
      expect(emissions).toEqual([{}]);  // No computed yet

      multiply.receive({ y: 4 });
      expect(emissions).toEqual([{}, { computed: 12 }]);
    });

    it('should allow updating arguments after computation', () => {
      type Args = { x: number; y: number };
      const add = withTaps(quick(
        partialProto((args: Args) => args.x + args.y, ['x', 'y']),
        {}
      ));

      const emissions: any[] = [];
      add.tap(e => emissions.push(e));

      add.receive({ x: 5, y: 3 });
      expect(emissions[0]).toEqual({ computed: 8 });

      add.receive({ x: 10 });  // Update x
      expect(emissions[1]).toEqual({ computed: 13 });  // 10 + 3
    });

    it('should work with three arguments', () => {
      type Args = { x: number; y: number; z: number };
      const sum = quick(
        partialProto((args: Args) => args.x + args.y + args.z, ['x', 'y', 'z']),
        {}
      );

      sum.receive({ x: 1 });
      sum.receive({ y: 2 });
      expect(sum.current()).toEqual({ x: 1, y: 2 });

      sum.receive({ z: 3 });
      expect(sum.current()).toEqual({ x: 1, y: 2, z: 3 });
    });

    it('should handle all args provided at once', () => {
      type Args = { x: number; y: number };
      const add = withTaps(quick(
        partialProto((args: Args) => args.x + args.y, ['x', 'y']),
        {}
      ));

      const emissions: any[] = [];
      add.tap(e => emissions.push(e));

      add.receive({ x: 5, y: 3 });
      expect(emissions).toEqual([{ computed: 8 }]);
    });
  });

  describe('fallibleProto - Fallible Transformations', () => {
    it('should compute successfully on valid input', () => {
      const parse = quick(fallibleProto(JSON.parse), undefined);

      parse.receive('{"x": 1}');
      expect(parse.current()).toEqual({ x: 1 });
    });

    it('should emit computed effect on success', () => {
      const parse = withTaps(quick(fallibleProto(JSON.parse), undefined));

      const emissions: any[] = [];
      parse.tap(e => emissions.push(e));

      parse.receive('{"x": 1}');
      expect(emissions[0]).toEqual({ computed: { x: 1 } });
    });

    it('should emit failed effect on error', () => {
      const parse = withTaps(quick(fallibleProto(JSON.parse), undefined));

      const emissions: any[] = [];
      parse.tap(e => emissions.push(e));

      parse.receive('bad json');

      expect(emissions).toHaveLength(1);
      expect(emissions[0]).toHaveProperty('failed');
      expect(emissions[0].failed).toHaveProperty('input', 'bad json');
      expect(emissions[0].failed).toHaveProperty('error');
    });

    it('should not update state on failure', () => {
      const parse = quick(fallibleProto(JSON.parse), undefined);

      parse.receive('{"x": 1}');
      expect(parse.current()).toEqual({ x: 1 });

      parse.receive('bad json');
      expect(parse.current()).toEqual({ x: 1 });  // Still the old value
    });

    it('should include error message in failed effect', () => {
      const divide = withTaps(quick(
        fallibleProto((x: number) => {
          if (x === 0) throw new Error('Division by zero');
          return 100 / x;
        }),
        undefined
      ));

      const emissions: any[] = [];
      divide.tap(e => emissions.push(e));

      divide.receive(0);
      expect(emissions[0].failed.error).toContain('Division by zero');
    });

    it('should recover from errors', () => {
      const parse = withTaps(quick(fallibleProto(JSON.parse), undefined));

      const emissions: any[] = [];
      parse.tap(e => emissions.push(e));

      parse.receive('bad json');
      expect(emissions[0]).toHaveProperty('failed');

      parse.receive('{"x": 2}');
      expect(emissions[1]).toEqual({ computed: { x: 2 } });
    });
  });

  describe('Protocol Compliance', () => {
    it('transform implements Transform<In, Out> protocol', () => {
      const double = withTaps(quick(transformProto((x: number) => x * 2), undefined));

      // Has receive(In)
      expect(typeof double.receive).toBe('function');

      // Has tap() for observing effects
      expect(typeof double.tap).toBe('function');

      // Emits { computed: Out }
      const emissions: any[] = [];
      double.tap(e => emissions.push(e));
      double.receive(5);
      expect(emissions[0]).toEqual({ computed: 10 });
    });

    it('partial implements PartialFunction<Args, Out> protocol', () => {
      type Args = { x: number; y: number };
      const add = withTaps(quick(
        partialProto((args: Args) => args.x + args.y, ['x', 'y']),
        {}
      ));

      // Has receive(Partial<Args>)
      expect(typeof add.receive).toBe('function');

      // Emits { computed: Out }
      const emissions: any[] = [];
      add.tap(e => emissions.push(e));
      add.receive({ x: 5, y: 3 });
      expect(emissions[0]).toEqual({ computed: 8 });
    });

    it('fallible implements FallibleTransform<In, Out> protocol', () => {
      const parse = withTaps(quick(fallibleProto(JSON.parse), undefined));

      const emissions: any[] = [];
      parse.tap(e => emissions.push(e));

      // Emits { computed } on success
      parse.receive('{"x": 1}');
      expect(emissions[0]).toEqual({ computed: { x: 1 } });

      // Emits { failed } on error
      parse.receive('bad');
      expect(emissions[1]).toHaveProperty('failed');
    });
  });
});
