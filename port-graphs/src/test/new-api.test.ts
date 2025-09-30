/**
 * Test that the NEW API (context.ts system) exports work correctly
 * This tests what users will actually import from 'port-graphs'
 */

import { describe, it, expect } from 'vitest';

// Import from main package - this is what users will do
import {
  // Core machinery
  protoGadget,
  quick,
  withTaps,

  // Cell primitives
  maxStep,
  minStep,
  lastStep,
  unionStep,
  mergeHandler,
  maxProto,
  minProto,
  lastProto,
  unionProto,

  // Table primitives
  lastTableStep,
  familyTableStep,
  tableHandler,
  lastTableProto,
  familyTableProto,

  // UI primitives
  sliderStep,
  toggleStep,
  uiHandler,
  sliderProto,
  toggleProto,

  // Function primitives
  fnStep,
  fnHandler,
  fnProto,

  // IO primitives
  localStorageStep,
  fileIOStep,
  ioHandler,
  localStorageProto,
  fileIOProto,
} from '../index';

describe('NEW API exports', () => {
  it('should export all core machinery', () => {
    expect(typeof protoGadget).toBe('function');
    expect(typeof quick).toBe('function');
    expect(typeof withTaps).toBe('function');
  });

  it('should export cell primitives', () => {
    expect(typeof maxStep).toBe('function');
    expect(typeof minStep).toBe('function');
    expect(typeof lastStep).toBe('function');
    expect(typeof unionStep).toBe('function');
    expect(typeof mergeHandler).toBe('function');

    // Protos
    expect(maxProto).toBeDefined();
    expect(minProto).toBeDefined();
    expect(lastProto).toBeDefined();
    expect(unionProto).toBeDefined();
  });

  it('should work with maxCell using proto', () => {
    const max = withTaps(quick(maxProto, 0));

    max.receive(5);
    expect(max.current()).toBe(5);

    max.receive(3); // Should ignore (not higher)
    expect(max.current()).toBe(5);

    max.receive(10);
    expect(max.current()).toBe(10);
  });

  it('should work with unionCell using proto', () => {
    const union = withTaps(quick(unionProto<number>(), new Set([1, 2])));

    expect(union.current()).toEqual(new Set([1, 2]));

    union.receive(new Set([2, 3])); // Should merge
    expect(union.current()).toEqual(new Set([1, 2, 3]));

    union.receive(new Set([1])); // Should ignore (subset)
    expect(union.current()).toEqual(new Set([1, 2, 3]));
  });

  it('should work with taps', () => {
    const max = withTaps(quick(maxProto, 0));

    const emissions: unknown[] = [];
    max.tap(effect => emissions.push(effect));

    max.receive(5);
    expect(emissions).toHaveLength(1);
    expect(emissions[0]).toEqual({ merge: 5 });
  });

  it('should work with lastTable using proto', () => {
    const table = withTaps(quick(lastTableProto<string, number>(), { a: 1, b: 2 }));

    expect(table.current()).toEqual({ a: 1, b: 2 });

    table.receive({ c: 3 });
    expect(table.current()).toEqual({ a: 1, b: 2, c: 3 });

    table.receive({ a: null }); // Remove 'a'
    expect(table.current()).toEqual({ b: 2, c: 3 });
  });

  it('should work with slider using proto', () => {
    const slider = withTaps(quick(sliderProto, { value: 50, min: 0, max: 100, step: 1 }));

    expect(slider.current().value).toBe(50);

    slider.receive({ set: 75 });
    expect(slider.current().value).toBe(75);

    slider.receive({ increment: {} });
    expect(slider.current().value).toBe(76);
  });
});
