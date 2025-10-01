/**
 * Test that the NEW API (context.ts system) exports work correctly
 * This tests what users will actually import from '@bassline/core'
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
  intersectionStep,
  mergeHandler,
  contradictionHandler,
  maxProto,
  minProto,
  lastProto,
  unionProto,
  intersectionProto,

  // Function primitives
  transformStep,
  partialStep,
  fallibleStep,
  requesterStep,
  functionHandler,
  requesterHandler,
  transformProto,
  partialProto,
  fallibleProto,
  requesterProto,
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
    expect(typeof intersectionStep).toBe('function');
    expect(typeof mergeHandler).toBe('function');
    expect(typeof contradictionHandler).toBe('function');

    // Protos
    expect(maxProto).toBeDefined();
    expect(minProto).toBeDefined();
    expect(lastProto).toBeDefined();
    expect(unionProto).toBeDefined();
    expect(intersectionProto).toBeDefined();
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

  it('should work with intersectionCell and handle contradictions', () => {
    const intersection = withTaps(quick(intersectionProto<number>(), new Set([1, 2, 3])));

    const emissions: any[] = [];
    intersection.tap(e => emissions.push(e));

    intersection.receive(new Set([2, 3, 4]));
    expect(intersection.current()).toEqual(new Set([2, 3]));
    expect(emissions[0]).toEqual({ changed: new Set([2, 3]) });

    intersection.receive(new Set([7, 8])); // Empty intersection
    expect(emissions.some(e => 'contradiction' in e)).toBe(true);
  });

  it('should work with taps', () => {
    const max = withTaps(quick(maxProto, 0));

    const emissions: unknown[] = [];
    max.tap(effect => emissions.push(effect));

    max.receive(5);
    expect(emissions).toHaveLength(1);
    expect(emissions[0]).toEqual({ changed: 5 });
  });

  it('should export function primitives', () => {
    expect(typeof transformStep).toBe('function');
    expect(typeof partialStep).toBe('function');
    expect(typeof fallibleStep).toBe('function');
    expect(typeof requesterStep).toBe('function');
    expect(typeof functionHandler).toBe('function');
    expect(typeof requesterHandler).toBe('function');

    // Protos
    expect(typeof transformProto).toBe('function');
    expect(typeof partialProto).toBe('function');
    expect(typeof fallibleProto).toBe('function');
    expect(typeof requesterProto).toBe('function');
  });

  it('should work with transformProto', () => {
    const double = withTaps(quick(transformProto((x: number) => x * 2), undefined));

    const emissions: any[] = [];
    double.tap(e => emissions.push(e));

    double.receive(5);
    expect(double.current()).toBe(10);
    expect(emissions[0]).toEqual({ computed: 10 });
  });

  it('should work with requesterProto', async () => {
    const fetcher = withTaps(quick(
      requesterProto(async (id: number) => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return { id, name: 'User' };
      }),
      { lastRequest: undefined, lastResponse: undefined }
    ));

    const emissions: any[] = [];
    fetcher.tap(e => emissions.push(e));

    fetcher.receive(123);

    // Immediate: requested
    expect(emissions[0]).toEqual({ requested: 123 });

    // Wait for async
    await new Promise(resolve => setTimeout(resolve, 20));

    // Later: responded
    expect(emissions[1]).toEqual({ responded: { id: 123, name: 'User' } });
  });
});
