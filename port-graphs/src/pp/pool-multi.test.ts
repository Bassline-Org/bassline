/**
 * Integration tests for pool-based multi-argument patterns
 */

import { describe, it, expect } from 'vitest';
import { fn } from "./patterns";
import { createPool, assert, Assertion } from "./pool";
import { EventfulGadget, emitEvent } from "./event-gadget";
import { 
  semanticAccumulator, 
  multiNeedsGadget, 
  binaryOp,
  TaggedValue
} from "./pool-multi";

describe('Pool-Based Multi-Argument Functions', () => {
  
  it('should accumulate semantic inputs and fire on every change', () => {
    const results: number[] = [];
    
    // Create a gadget that needs two inputs (no reset)
    const adder = new EventfulGadget<TaggedValue>('adder')
      .use(semanticAccumulator<
        { left: number; right: number },
        number,
        EventfulGadget<TaggedValue>
      >(
        ['left', 'right'],
        ({ left, right }) => left + right,
        (value) => results.push(value),
        false // don't reset - maintain state
      ));
    
    // First input - not ready
    adder.receive({ tag: 'right', value: 5 });
    expect(results).toEqual([]); // Not ready yet
    
    // Second input - now fires
    adder.receive({ tag: 'left', value: 3 });
    expect(results).toEqual([8]); // 3 + 5 = 8
    
    // Update left - fires again with new value
    adder.receive({ tag: 'left', value: 10 });
    expect(results).toEqual([8, 15]); // 10 + 5 = 15
    
    // Update right - fires again
    adder.receive({ tag: 'right', value: 20 });
    expect(results).toEqual([8, 15, 30]); // 10 + 20 = 30
    
    // Update left again
    adder.receive({ tag: 'left', value: 7 });
    expect(results).toEqual([8, 15, 30, 27]); // 7 + 20 = 27
  });

  it('should reset state when configured', () => {
    const results: number[] = [];
    
    // Create a gadget with reset enabled
    const adder = new EventfulGadget<TaggedValue>('adder')
      .use(semanticAccumulator<
        { a: number; b: number },
        number,
        EventfulGadget<TaggedValue>
      >(
        ['a', 'b'],
        ({ a, b }) => a + b,
        (value) => results.push(value),
        true // reset after firing
      ));
    
    // First pair
    adder.receive({ tag: 'a', value: 3 });
    adder.receive({ tag: 'b', value: 5 });
    expect(results).toEqual([8]);
    
    // After reset, needs both inputs again
    adder.receive({ tag: 'a', value: 10 });
    expect(results).toEqual([8]); // Waiting for b
    
    adder.receive({ tag: 'b', value: 20 });
    expect(results).toEqual([8, 30]); // Now fires
  });

  it('should wire multi-needs gadgets through pool', () => {
    const results: number[] = [];
    
    // Create pool
    const pool = new EventfulGadget<Assertion>('pool')
      .use(createPool((match) => {
        if (match.provider.gadget && match.consumer.gadget) {
          const provider = match.provider.gadget as EventfulGadget<number>;
          const consumer = match.consumer.gadget as EventfulGadget<TaggedValue>;
          const tag = match.tag;
          
          provider.addEventListener(tag, (e: Event) => {
            consumer.receive({ tag, value: (e as CustomEvent).detail });
          });
        }
      }));
    
    // Create sources
    const tempSensor = new EventfulGadget<number>('temp')
      .use(fn(
        (t: number) => t,
        emitEvent('temperature')
      ));
    
    const humiditySensor = new EventfulGadget<number>('humidity')
      .use(fn(
        (h: number) => h,
        emitEvent('humidity')
      ));
    
    // Create multi-needs calculator (no reset - maintains state)
    const heatIndex = multiNeedsGadget<
      { temperature: number; humidity: number },
      number
    >(
      'heat-index',
      ['temperature', 'humidity'],
      ({ temperature, humidity }) => temperature + humidity * 0.1,
      (value) => results.push(value),
      { reset: false }
    );
    
    // Register with pool
    pool.receive(assert.provides('temp', 'temperature', tempSensor));
    pool.receive(assert.provides('humidity', 'humidity', humiditySensor));
    heatIndex.registerWith(pool);
    
    // Send data
    tempSensor.receive(25);
    expect(results).toEqual([]); // Waiting for humidity
    
    humiditySensor.receive(60);
    expect(results).toEqual([31]); // 25 + 60 * 0.1 = 31
    
    // Update temperature - recalculates with existing humidity
    tempSensor.receive(30);
    expect(results).toEqual([31, 36]); // 30 + 60 * 0.1 = 36
    
    // Update humidity - recalculates with existing temperature  
    humiditySensor.receive(70);
    expect(results).toEqual([31, 36, 37]); // 30 + 70 * 0.1 = 37
  });

  it('should support binary operators', () => {
    const results: number[] = [];
    
    // Create a multiplier using binaryOp (no reset)
    const multiplier = binaryOp<number, number>(
      'multiplier',
      'a',
      'b',
      (a, b) => a * b,
      (value) => results.push(value),
      { reset: false }
    );
    
    // Send inputs
    multiplier.receive({ tag: 'a', value: 4 });
    multiplier.receive({ tag: 'b', value: 7 });
    expect(results).toEqual([28]); // 4 * 7
    
    // Update b - recalculates
    multiplier.receive({ tag: 'b', value: 3 });
    expect(results).toEqual([28, 12]); // 4 * 3
    
    // Update a - recalculates
    multiplier.receive({ tag: 'a', value: 5 });
    expect(results).toEqual([28, 12, 15]); // 5 * 3
  });

  it('should handle three or more inputs', () => {
    const results: string[] = [];
    
    // Create a gadget that needs three inputs
    const combiner = new EventfulGadget<TaggedValue>('combiner')
      .use(semanticAccumulator<
        { x: number; y: number; z: number },
        string,
        EventfulGadget<TaggedValue>
      >(
        ['x', 'y', 'z'],
        ({ x, y, z }) => `(${x}, ${y}, ${z})`,
        (value) => results.push(value),
        true
      ));
    
    // Send inputs one by one
    combiner.receive({ tag: 'y', value: 2 });
    expect(results).toEqual([]);
    
    combiner.receive({ tag: 'z', value: 3 });
    expect(results).toEqual([]);
    
    combiner.receive({ tag: 'x', value: 1 });
    expect(results).toEqual(['(1, 2, 3)']);
  });

  it('should ignore unexpected tags', () => {
    const results: number[] = [];
    
    const adder = new EventfulGadget<TaggedValue>('adder')
      .use(semanticAccumulator<
        { a: number; b: number },
        number,
        EventfulGadget<TaggedValue>
      >(
        ['a', 'b'],
        ({ a, b }) => a + b,
        (value) => results.push(value),
        true
      ));
    
    // Send unexpected tag
    adder.receive({ tag: 'unexpected', value: 999 });
    adder.receive({ tag: 'a', value: 5 });
    adder.receive({ tag: 'b', value: 3 });
    
    expect(results).toEqual([8]); // Unexpected tag ignored
  });

  it('should maintain state when reset is false', () => {
    const results: number[] = [];
    
    const maxAccumulator = new EventfulGadget<TaggedValue>('max')
      .use(semanticAccumulator<
        { current: number; threshold: number },
        number,
        EventfulGadget<TaggedValue>
      >(
        ['current', 'threshold'],
        ({ current, threshold }) => current > threshold ? current : null,
        (value) => results.push(value),
        false // Don't reset
      ));
    
    // Set threshold first
    maxAccumulator.receive({ tag: 'threshold', value: 10 });
    // Current not set yet, so no fire
    
    // Set current - fires if > threshold
    maxAccumulator.receive({ tag: 'current', value: 15 });
    expect(results).toEqual([15]); // 15 > 10
    
    // Update current with lower value - returns null so doesn't fire
    maxAccumulator.receive({ tag: 'current', value: 8 });
    expect(results).toEqual([15]); // 8 < 10, compute returns null
    
    // Update current with value above threshold
    maxAccumulator.receive({ tag: 'current', value: 12 });
    expect(results).toEqual([15, 12]); // 12 > 10
    
    // Update threshold higher - recalculates with existing current
    maxAccumulator.receive({ tag: 'threshold', value: 11 });
    expect(results).toEqual([15, 12, 12]); // 12 > 11, fires again
    
    // Update threshold even higher - now current is below
    maxAccumulator.receive({ tag: 'threshold', value: 13 });
    expect(results).toEqual([15, 12, 12]); // 12 < 13, compute returns null
  });

  it('should chain multi-needs gadgets', () => {
    const results: Record<string, number[]> = {
      sum: [],
      product: [],
      final: []
    };
    
    // Create pool
    const pool = new EventfulGadget<Assertion>('pool')
      .use(createPool((match) => {
        if (match.provider.gadget && match.consumer.gadget) {
          const provider = match.provider.gadget as EventfulGadget<unknown>;
          const consumer = match.consumer.gadget as EventfulGadget<TaggedValue>;
          const tag = match.tag;
          
          provider.addEventListener(tag, (e: Event) => {
            consumer.receive({ tag, value: (e as CustomEvent).detail });
          });
        }
      }));
    
    // First stage: sum and product
    const summer = multiNeedsGadget<
      { a: number; b: number },
      number
    >(
      'summer',
      ['a', 'b'],
      ({ a, b }) => a + b,
      (value) => {
        results.sum.push(value);
        (summer as any).emit('sum', value);
      },
      { provides: 'sum', reset: true }
    );
    
    const multiplier = multiNeedsGadget<
      { a: number; b: number },
      number
    >(
      'multiplier',
      ['a', 'b'],
      ({ a, b }) => a * b,
      (value) => {
        results.product.push(value);
        (multiplier as any).emit('product', value);
      },
      { provides: 'product', reset: true }
    );
    
    // Second stage: combine sum and product
    const combiner = multiNeedsGadget<
      { sum: number; product: number },
      number
    >(
      'combiner',
      ['sum', 'product'],
      ({ sum, product }) => sum + product,
      (value) => results.final.push(value),
      { reset: true }
    );
    
    // Create sources
    const sourceA = new EventfulGadget<number>('sourceA')
      .use(fn((v: number) => v, emitEvent('a')));
    
    const sourceB = new EventfulGadget<number>('sourceB')
      .use(fn((v: number) => v, emitEvent('b')));
    
    // Register everything
    pool.receive(assert.provides('sourceA', 'a', sourceA));
    pool.receive(assert.provides('sourceB', 'b', sourceB));
    summer.registerWith(pool);
    multiplier.registerWith(pool);
    combiner.registerWith(pool);
    
    // Send data
    sourceA.receive(3);
    sourceB.receive(4);
    
    expect(results.sum).toEqual([7]);      // 3 + 4
    expect(results.product).toEqual([12]); // 3 * 4
    expect(results.final).toEqual([19]);   // 7 + 12
  });
});