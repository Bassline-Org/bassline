/**
 * Comprehensive test suite for the gadget system
 * Tests the consider → act protocol with context passing
 */

import { describe, it, expect } from 'vitest';
import { createGadget } from '../core';
import { maxCell, minCell } from '../patterns/cells/numeric';
import { unionCell, intersectionCell } from '../patterns/cells/set';
import { firstMap, lastMap, unionMap } from '../patterns/cells/maps';
import { numberp, stringp, arrayp } from '../patterns/cells/predicates';
import { adder, subtractor, multiplier, divider, binary } from '../patterns/functions/numeric';
import { wires } from '../semantics/manualWires';
import { extendGadget } from '../semantics';
import { changed, noop, contradiction } from '../effects';

describe('Core Gadget Protocol', () => {
  it('should follow consider → act protocol', () => {
    let considerCalled = false;
    let actionCalled = false;

    const testGadget = createGadget<number, number>(
      (current, incoming) => {
        considerCalled = true;
        if (incoming > current) {
          return { action: 'update', context: { value: incoming } };
        }
        return null;
      },
      {
        'update': (gadget, context) => {
          actionCalled = true;
          gadget.update(context.value);
          return changed(context.value);
        }
      }
    )(0);

    testGadget.receive(5);
    expect(considerCalled).toBe(true);
    expect(actionCalled).toBe(true);
    expect(testGadget.current()).toBe(5);
  });

  it('should pass computed context from consider to act', () => {
    // This tests that we don't recompute expensive operations
    let computeCount = 0;

    const expensiveGadget = createGadget<number[], number[]>(
      (_current, incoming) => {
        // Expensive computation happens once
        const expensiveResult = incoming.map(n => {
          computeCount++;
          return n * n;
        });

        return { action: 'process', context: { computed: expensiveResult } };
      },
      {
        'process': (gadget, context) => {
          // Use the already computed result
          gadget.update(context.computed);
          return changed(context.computed);
        }
      }
    )([]);

    expensiveGadget.receive([1, 2, 3, 4, 5]);
    expect(computeCount).toBe(5); // Should only compute once per element
    expect(expensiveGadget.current()).toEqual([1, 4, 9, 16, 25]);
  });

  it('should handle null return from consider (no action)', () => {
    const emissions: any[] = [];

    const selectiveGadget = createGadget<number, number>(
      (_current, incoming) => {
        if (incoming % 2 === 0) {
          return { action: 'accept', context: { value: incoming } };
        }
        return null; // Ignore odd numbers
      },
      {
        'accept': (gadget, context) => {
          gadget.update(context.value);
          return changed(context.value);
        }
      }
    )(0);

    selectiveGadget.emit = (effect) => emissions.push(effect);

    selectiveGadget.receive(1); // Odd - should be ignored
    selectiveGadget.receive(2); // Even - should be accepted
    selectiveGadget.receive(3); // Odd - should be ignored
    selectiveGadget.receive(4); // Even - should be accepted

    expect(emissions).toEqual([
      changed(2),
      changed(4)
    ]);
    expect(selectiveGadget.current()).toBe(4);
  });
});

describe('Numeric Cell Patterns', () => {
  it('maxCell should track maximum value', () => {
    const max = maxCell(10);
    const emissions: any[] = [];
    max.emit = (effect) => emissions.push(effect);

    max.receive(5);   // Less than 10, no change
    max.receive(15);  // Greater than 10, updates to 15
    max.receive(12);  // Less than 15, no change
    max.receive(20);  // Greater than 15, updates to 20

    expect(max.current()).toBe(20);
    expect(emissions).toEqual([
      changed(15),
      changed(20)
    ]);
  });

  it('minCell should track minimum value', () => {
    const min = minCell(10);
    const emissions: any[] = [];
    min.emit = (effect) => emissions.push(effect);

    min.receive(15);  // Greater than 10, no change
    min.receive(5);   // Less than 10, updates to 5
    min.receive(8);   // Greater than 5, no change
    min.receive(3);   // Less than 5, updates to 3

    expect(min.current()).toBe(3);
    expect(emissions).toEqual([
      changed(5),
      changed(3)
    ]);
  });
});

describe('Set Cell Patterns', () => {
  it('unionCell should accumulate all unique elements', () => {
    const union = unionCell(new Set([1, 2, 3]));
    const emissions: any[] = [];
    union.emit = (effect) => emissions.push(effect);

    union.receive(new Set([2, 3, 4])); // Adds 4
    expect(union.current()).toEqual(new Set([1, 2, 3, 4]));

    union.receive(new Set([1, 2])); // Subset, no change
    expect(emissions.length).toBe(1);

    union.receive(new Set([5, 6])); // Adds 5, 6
    expect(union.current()).toEqual(new Set([1, 2, 3, 4, 5, 6]));
    expect(emissions.length).toBe(2);
  });

  it('intersectionCell should find common elements', () => {
    const intersection = intersectionCell(new Set([1, 2, 3, 4]));
    const emissions: any[] = [];
    intersection.emit = (effect) => emissions.push(effect);

    intersection.receive(new Set([2, 3, 4, 5])); // Common: 2, 3, 4
    expect(intersection.current()).toEqual(new Set([2, 3, 4]));

    intersection.receive(new Set([3, 4])); // Common: 3, 4
    expect(intersection.current()).toEqual(new Set([3, 4]));

    intersection.receive(new Set([5, 6])); // No common elements
    expect(emissions[emissions.length - 1]).toEqual(
      contradiction(new Set([3, 4]), new Set([5, 6]))
    );
  });

  it('should not recompute intersection multiple times', () => {
    let intersectionCount = 0;
    const originalIntersection = Set.prototype.intersection;

    // Mock intersection to count calls
    Set.prototype.intersection = function (other) {
      intersectionCount++;
      return originalIntersection.call(this, other);
    };

    const intersection = intersectionCell(new Set([1, 2, 3]));
    intersection.receive(new Set([2, 3, 4]));

    // Should only compute intersection once during consider
    expect(intersectionCount).toBe(1);
    expect(intersection.current()).toEqual(new Set([2, 3]));

    // Restore original
    Set.prototype.intersection = originalIntersection;
  });
});

describe('Map Cell Patterns', () => {
  it('firstMap should prefer existing values', () => {
    const first = firstMap({ a: 1, b: 2 });
    const emissions: any[] = [];
    first.emit = (effect) => emissions.push(effect);

    first.receive({ c: 3 });
    expect(first.current()).toEqual({ a: 1, b: 2, c: 3 });

    first.receive({ a: 10, d: 4 }); // a=1 takes precedence
    expect(first.current()).toEqual({ a: 1, b: 2, c: 3, d: 4 });
  });

  it('lastMap should prefer incoming values', () => {
    const last = lastMap({ a: 1, b: 2 });
    const emissions: any[] = [];
    last.emit = (effect) => emissions.push(effect);

    last.receive({ c: 3 });
    expect(last.current()).toEqual({ a: 1, b: 2, c: 3 });

    last.receive({ a: 10, d: 4 }); // a=10 overwrites
    expect(last.current()).toEqual({ a: 10, b: 2, c: 3, d: 4 });
  });

  it('unionMap should merge arrays', () => {
    const union = unionMap({ tags: ['a', 'b'], ids: [1, 2] });
    const emissions: any[] = [];
    union.emit = (effect) => emissions.push(effect);

    union.receive({ tags: ['b', 'c'], ids: [2, 3] });
    expect(union.current()).toEqual({
      tags: ['a', 'b', 'c'],
      ids: [1, 2, 3]
    });

    union.receive({ tags: ['d'], newKey: [4] });
    expect(union.current()).toEqual({
      tags: ['a', 'b', 'c', 'd'],
      ids: [1, 2, 3],
      newKey: [4]
    });
  });

  it('should ignore null/undefined values in maps', () => {
    const first = firstMap({ a: 1 });
    first.receive({ b: null, c: undefined, d: 2 });
    expect(first.current()).toEqual({ a: 1, d: 2 });
  });
});

describe('Predicate Patterns', () => {
  it('should only accept values matching predicate', () => {
    const numOnly = numberp(null);
    const emissions: any[] = [];
    numOnly.emit = (effect) => emissions.push(effect);

    numOnly.receive('string'); // Rejected
    numOnly.receive(42);        // Accepted
    numOnly.receive([1, 2, 3]); // Rejected
    numOnly.receive(3.14);      // Accepted
    numOnly.receive(3.14);      // Same value, no change

    expect(numOnly.current()).toBe(3.14);
    expect(emissions).toEqual([
      changed(42),
      changed(3.14)
    ]);
  });

  it('should work with different type predicates', () => {
    const str = stringp(undefined);
    const arr = arrayp(undefined);

    str.receive(123);
    expect(str.current()).toBe(undefined);

    str.receive('hello');
    expect(str.current()).toBe('hello');

    arr.receive('not array');
    expect(arr.current()).toBe(undefined);

    arr.receive([1, 2, 3]);
    expect(arr.current()).toEqual([1, 2, 3]);
  });
});

describe('Function Patterns', () => {
  it('should accumulate arguments and compute when ready', () => {
    const add = adder({});
    const emissions: any[] = [];
    add.emit = (effect) => emissions.push(effect);

    add.receive({ a: 5 });
    expect(add.current().result).toBe(undefined);
    expect(emissions[0]).toEqual(noop());

    add.receive({ b: 3 });
    expect(add.current().result).toBe(8);
    expect(emissions[1]).toEqual(changed({ result: 8, args: { a: 5, b: 3 } }));
  });

  it('should handle partial binding naturally', () => {
    const mult = multiplier({ a: 2 });
    const emissions: any[] = [];
    mult.emit = (effect) => emissions.push(effect);

    mult.receive({ b: 5 });
    expect(mult.current().result).toBe(10);

    mult.receive({ a: 3 }); // Update a
    expect(mult.current().result).toBe(15);

    mult.receive({ b: 4 }); // Update b
    expect(mult.current().result).toBe(12);
  });

  it('should not recompute if result unchanged', () => {
    const sub = subtractor({});
    const emissions: any[] = [];
    sub.emit = (effect) => emissions.push(effect);

    // Provide initial values
    sub.receive({ a: 10, b: 5 });
    expect(sub.current().result).toBe(5);
    expect(emissions.length).toBe(1);
    emissions.length = 0; // Reset

    sub.receive({}); // No new args, but still accumulates (emits noop)
    expect(emissions.length).toBe(1);
    expect(emissions[0]).toEqual(noop());
    emissions.length = 0;

    sub.receive({ a: 10, b: 5 }); // Same args, same result
    expect(emissions.length).toBe(0);

    sub.receive({ a: 15 }); // Different result
    expect(emissions.length).toBe(1);
    expect(sub.current().result).toBe(10);
  });

  it('should work with custom binary functions', () => {
    const concat = binary<string, string, string>((a, b) => a + b);
    const concatGadget = concat({});

    concatGadget.receive({ a: 'Hello' });
    concatGadget.receive({ b: ' World' });
    expect(concatGadget.current().result).toBe('Hello World');
  });

  it('divider should handle division', () => {
    const div = divider({});
    const emissions: any[] = [];
    div.emit = (effect) => emissions.push(effect);

    div.receive({ a: 10, b: 2 });
    expect(div.current().result).toBe(5);

    div.receive({ b: 0 }); // Division by zero
    expect(div.current().result).toBe(Infinity);
  });
});

describe('Wiring Mechanisms', () => {
  it('directed wire should pass changed effects', () => {
    const source = maxCell(0);
    const target = minCell(100);

    wires.directed(source, target);

    source.receive(50);
    expect(target.current()).toBe(50);

    source.receive(25); // No change in source
    expect(target.current()).toBe(50); // Target unchanged

    source.receive(75);
    expect(target.current()).toBe(50); // Min stays at 50
  });

  it('bidirectional wire should work both ways', () => {
    const gadget1 = maxCell(10);
    const gadget2 = maxCell(20);

    wires.bi(gadget1, gadget2);

    gadget1.receive(30);
    expect(gadget2.current()).toBe(30);

    gadget2.receive(40);
    expect(gadget1.current()).toBe(40);
  });

  it('effectDirected should pass entire effects', () => {
    const source = maxCell(0);
    const effectCollector = createGadget<any[], any>(
      (_current, incoming) => {
        return { action: 'collect', context: { effect: incoming } };
      },
      {
        'collect': (gadget, context) => {
          const updated = [...gadget.current(), context.effect];
          gadget.update(updated);
          return changed(updated);
        }
      }
    )([]);

    wires.effectDirected(source, effectCollector);

    source.receive(10);
    expect(effectCollector.current()).toEqual([
      changed(10)
    ]);
  });

  it('should chain multiple wires', () => {
    const g1 = maxCell(0);
    const g2 = minCell(100);
    const g3 = maxCell(-100);

    wires.directed(g1, g2);
    wires.directed(g2, g3);

    g1.receive(50);
    expect(g2.current()).toBe(50);
    expect(g3.current()).toBe(50);
  });
});

describe('Extension Mechanisms', () => {
  it('extendGadget should add behavior to emit', () => {
    const emissions: any[] = [];
    const sideEffects: any[] = [];

    const gadget = maxCell(0);
    gadget.emit = (effect) => emissions.push(effect);

    extendGadget(gadget)((effect) => {
      sideEffects.push({ logged: effect });
    });

    gadget.receive(10);

    expect(emissions).toEqual([changed(10)]);
    expect(sideEffects).toEqual([{ logged: changed(10) }]);
  });

  it('should allow multiple extensions', () => {
    const logs: string[] = [];
    const gadget = maxCell(0);

    extendGadget(gadget)(() => logs.push('ext1'));
    extendGadget(gadget)(() => logs.push('ext2'));
    extendGadget(gadget)(() => logs.push('ext3'));

    gadget.receive(10);
    expect(logs).toEqual(['ext3', 'ext2', 'ext1']); // Reverse order
  });
});

describe('Edge Cases and Error Conditions', () => {
  it('should handle undefined action gracefully', () => {
    const gadget = createGadget<number, number>(
      () => ({ action: 'nonexistent', context: {} }),
      {} // No actions defined
    )(0);

    expect(() => gadget.receive(5)).not.toThrow();
    expect(gadget.current()).toBe(0);
  });

  it('should handle missing context gracefully', () => {
    const gadget = createGadget<number, number>(
      () => ({ action: 'test' } as any), // No context
      {
        'test': (g, context) => {
          g.update(context?.value || 99);
          return changed(g.current());
        }
      }
    )(0);

    gadget.receive(5);
    expect(gadget.current()).toBe(99);
  });

  it('should handle null effects from actions', () => {
    const emissions: any[] = [];
    const gadget = createGadget<number, number>(
      () => ({ action: 'test', context: {} }),
      {
        'test': () => null
      }
    )(0);

    gadget.emit = (effect) => emissions.push(effect);
    gadget.receive(5);
    expect(emissions).toEqual([]);
  });

  it('should maintain state consistency', () => {
    const gadget = maxCell(10);

    // Receive multiple values rapidly
    [15, 12, 20, 18, 25, 22, 30].forEach(n => gadget.receive(n));

    expect(gadget.current()).toBe(30);
  });

  it('should handle empty sets correctly', () => {
    const union = unionCell(new Set());
    union.receive(new Set());
    expect(union.current()).toEqual(new Set());

    union.receive(new Set([1]));
    expect(union.current()).toEqual(new Set([1]));
  });

  it('should handle empty maps correctly', () => {
    const first = firstMap({});
    first.receive({});
    expect(first.current()).toEqual({});

    first.receive({ a: 1 });
    expect(first.current()).toEqual({ a: 1 });
  });
});