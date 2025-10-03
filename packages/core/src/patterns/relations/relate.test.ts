/**
 * Tests for Bidirectional Constraint Relations
 */

import { describe, it, expect } from 'vitest';
import { relate, forward, combine } from './relate';
import { withTaps, quick } from '../../core';
import { lastProto } from '../cells';

describe('relate() - Bidirectional Constraints', () => {
  it('should propagate changes forward (A → B)', () => {
    const a = withTaps(quick(lastProto<number>(), 3));
    const b = withTaps(quick(lastProto<number>(), 5));
    const c = withTaps(quick(lastProto<number>(), 8));

    // Constraint: a + b = c
    relate(a, c, {
      forward: (a) => a + b.current(),
      backward: (c) => c - b.current()
    });

    // Change a
    a.receive(4);

    // c should update
    expect(c.current()).toBe(9);
  });

  it('should propagate changes backward (B → A)', () => {
    const a = withTaps(quick(lastProto<number>(), 3));
    const b = withTaps(quick(lastProto<number>(), 5));
    const c = withTaps(quick(lastProto<number>(), 8));

    // Constraint: a + b = c
    relate(a, c, {
      forward: (a) => a + b.current(),
      backward: (c) => c - b.current()
    });

    // Change c
    c.receive(10);

    // a should update
    expect(a.current()).toBe(5);
  });

  it('should support multiple constraints (redundant pathways)', () => {
    const a = withTaps(quick(lastProto<number>(), 3));
    const b = withTaps(quick(lastProto<number>(), 5));
    const c = withTaps(quick(lastProto<number>(), 8));

    // Constraint 1: a + b = c
    relate(a, c, {
      forward: (a) => a + b.current(),
      backward: (c) => c - b.current()
    });

    // Constraint 2: b + a = c (different pathway)
    relate(b, c, {
      forward: (b) => a.current() + b,
      backward: (c) => c - a.current()
    });

    // Change a
    a.receive(4);

    // Both constraints propagate to c (idempotent, both give same result)
    expect(c.current()).toBe(9);

    // Change b
    b.receive(6);

    // Both constraints propagate to c
    expect(c.current()).toBe(10);
  });

  it('should converge with bidirectional loops (idempotent)', () => {
    const a = withTaps(quick(lastProto<number>(), 5));
    const b = withTaps(quick(lastProto<number>(), 5));

    // Identity constraint: a = b (bidirectional mirror)
    relate(a, b, {
      forward: (a) => a,
      backward: (b) => b
    });

    // Change a
    a.receive(10);

    // b should update
    expect(b.current()).toBe(10);

    // Change b
    b.receive(20);

    // a should update
    expect(a.current()).toBe(20);

    // Send same value again (should be idempotent, no extra propagation)
    a.receive(20);
    expect(b.current()).toBe(20);
  });

  it('should cleanup taps when cleanup function is called', () => {
    const a = withTaps(quick(lastProto<number>(), 3));
    const c = withTaps(quick(lastProto<number>(), 8));

    let changeCount = 0;
    c.tap(() => changeCount++);

    const cleanup = relate(a, c, {
      forward: (a) => a + 5,
      backward: (c) => c - 5
    });

    // Change a (c should update)
    a.receive(4);
    expect(changeCount).toBe(1);

    // Cleanup
    cleanup();

    // Change a again (c should NOT update)
    a.receive(5);
    expect(changeCount).toBe(1); // No new changes
    expect(c.current()).toBe(9); // Still old value
  });
});

describe('forward() - Unidirectional Constraints', () => {
  it('should propagate changes from source to target', () => {
    const count = withTaps(quick(lastProto<number>(), 5));
    const doubled = withTaps(quick(lastProto<number>(), 10));

    forward(count, doubled, (n) => n * 2);

    count.receive(7);
    expect(doubled.current()).toBe(14);
  });

  it('should not propagate changes backward', () => {
    const count = withTaps(quick(lastProto<number>(), 5));
    const doubled = withTaps(quick(lastProto<number>(), 10));

    forward(count, doubled, (n) => n * 2);

    // Change target
    doubled.receive(20);

    // Source should not change
    expect(count.current()).toBe(5);
  });

  it('should cleanup when cleanup function is called', () => {
    const source = withTaps(quick(lastProto<number>(), 5));
    const target = withTaps(quick(lastProto<number>(), 0));

    const cleanup = forward(source, target, (n) => n * 2);

    source.receive(3);
    expect(target.current()).toBe(6);

    cleanup();

    source.receive(4);
    expect(target.current()).toBe(6); // Unchanged
  });
});

describe('combine() - Multi-Source Constraints', () => {
  it('should update target when any source changes', () => {
    const a = withTaps(quick(lastProto<number>(), 3));
    const b = withTaps(quick(lastProto<number>(), 5));
    const sum = withTaps(quick(lastProto<number>(), 0));

    combine([a, b], sum, (sources) => {
      return sources[0].current() + sources[1].current();
    });

    // Initial propagation
    a.receive(3); // Trigger update
    expect(sum.current()).toBe(8);

    // Change a
    a.receive(4);
    expect(sum.current()).toBe(9);

    // Change b
    b.receive(6);
    expect(sum.current()).toBe(10);
  });

  it('should work with more than two sources', () => {
    const a = withTaps(quick(lastProto<number>(), 1));
    const b = withTaps(quick(lastProto<number>(), 2));
    const c = withTaps(quick(lastProto<number>(), 3));
    const sum = withTaps(quick(lastProto<number>(), 0));

    combine([a, b, c], sum, (sources) => {
      return sources.reduce((acc, s) => acc + s.current(), 0);
    });

    a.receive(1); // Trigger
    expect(sum.current()).toBe(6);

    b.receive(10);
    expect(sum.current()).toBe(14);
  });

  it('should cleanup all taps when cleanup function is called', () => {
    const a = withTaps(quick(lastProto<number>(), 3));
    const b = withTaps(quick(lastProto<number>(), 5));
    const sum = withTaps(quick(lastProto<number>(), 0));

    const cleanup = combine([a, b], sum, (sources) => {
      return sources[0].current() + sources[1].current();
    });

    a.receive(3);
    expect(sum.current()).toBe(8);

    cleanup();

    a.receive(10);
    expect(sum.current()).toBe(8); // Unchanged
  });
});

describe('Integration', () => {
  it('should support complex constraint networks', () => {
    // Build: a + b = c, c * 2 = d
    const a = withTaps(quick(lastProto<number>(), 2));
    const b = withTaps(quick(lastProto<number>(), 3));
    const c = withTaps(quick(lastProto<number>(), 5));
    const d = withTaps(quick(lastProto<number>(), 10));

    // Constraint 1: a + b = c
    relate(a, c, {
      forward: (a) => a + b.current(),
      backward: (c) => c - b.current()
    });

    // Constraint 2: c * 2 = d
    relate(c, d, {
      forward: (c) => c * 2,
      backward: (d) => d / 2
    });

    // Change a
    a.receive(4);
    expect(c.current()).toBe(7);  // 4 + 3
    expect(d.current()).toBe(14); // 7 * 2

    // Change d
    d.receive(20);
    expect(c.current()).toBe(10); // 20 / 2
    expect(a.current()).toBe(7);  // 10 - 3

    // Change b
    b.receive(5);
    // a is still 7, so c should be 7 + 5 = 12
    // But c is 10 from previous change, so this creates a contradiction
    // With lastCell, the most recent change wins
    a.receive(7); // Re-trigger
    expect(c.current()).toBe(12); // 7 + 5
    expect(d.current()).toBe(24); // 12 * 2
  });
});
