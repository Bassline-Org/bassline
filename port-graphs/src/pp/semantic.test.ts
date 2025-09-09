/**
 * Tests for message-based semantic routing
 */

import { describe, it, expect } from 'vitest';
import { Gadget } from "./core";
import { fn, cell } from "./patterns";
import { Message, fromValue, toValue, filterTag, mapMessage, retag } from "./message";
import { semanticAccumulator, bridge, unbridge, binaryOp } from "./semantic";
import { semanticPool, declare } from "./semantic-pool";

// Helper to create gadgets
function createGadget<T>(protocol: (this: Gadget<T>, data: T) => void): Gadget<T> {
  const gadget: Gadget<T> = {
    receive(data: T): void {
      protocol.call(gadget, data);
    }
  };
  return gadget;
}

describe('Message-based Patterns', () => {
  
  it('should convert values to messages and back', () => {
    const results: any[] = [];
    
    // Value -> Message
    const tagger = createGadget(
      fromValue<number>(
        'temperature',
        (msg) => results.push(msg)
      )
    );
    
    tagger.receive(25);
    expect(results[0]).toEqual({ tag: 'temperature', value: 25 });
    
    // Message -> Value
    const extractor = createGadget(
      toValue<number>(
        (value) => results.push(value)
      )
    );
    
    extractor.receive({ tag: 'any', value: 42 });
    expect(results[1]).toBe(42);
  });

  it('should filter messages by tag', () => {
    const results: Message[] = [];
    
    const filter = createGadget(
      filterTag<number>(
        'important',
        (msg) => results.push(msg)
      )
    );
    
    filter.receive({ tag: 'unimportant', value: 1 });
    filter.receive({ tag: 'important', value: 2 });
    filter.receive({ tag: 'other', value: 3 });
    filter.receive({ tag: 'important', value: 4 });
    
    expect(results).toEqual([
      { tag: 'important', value: 2 },
      { tag: 'important', value: 4 }
    ]);
  });

  it('should transform message values', () => {
    const results: Message[] = [];
    
    const doubler = createGadget(
      mapMessage<number, number>(
        (value) => value * 2,
        (msg) => results.push(msg)
      )
    );
    
    doubler.receive({ tag: 'data', value: 5 });
    doubler.receive({ tag: 'other', value: 10 });
    
    expect(results).toEqual([
      { tag: 'data', value: 10 },
      { tag: 'other', value: 20 }
    ]);
  });

  it('should retag messages', () => {
    const results: Message[] = [];
    
    const retagger = createGadget(
      retag<number>(
        'processed',
        (msg) => results.push(msg)
      )
    );
    
    retagger.receive({ tag: 'raw', value: 42 });
    expect(results[0]).toEqual({ tag: 'processed', value: 42 });
  });
});

describe('Semantic Accumulator', () => {
  
  it('should accumulate messages by tag and fire when ready', () => {
    const results: number[] = [];
    
    const adder = createGadget(
      semanticAccumulator<
        { left: number; right: number },
        number
      >(
        ['left', 'right'],
        ({ left, right }) => left + right,
        (value) => results.push(value)
      )
    );
    
    // Not ready yet
    adder.receive({ tag: 'left', value: 3 });
    expect(results).toEqual([]);
    
    // Now ready - fires
    adder.receive({ tag: 'right', value: 5 });
    expect(results).toEqual([8]);
    
    // Updates continue to fire
    adder.receive({ tag: 'left', value: 10 });
    expect(results).toEqual([8, 15]);
    
    adder.receive({ tag: 'right', value: 20 });
    expect(results).toEqual([8, 15, 30]);
  });

  it('should support binary operations with messages', () => {
    const results: number[] = [];
    
    const multiplier = createGadget(
      binaryOp<number, number>(
        'a',
        'b',
        (a, b) => a * b,
        (value) => results.push(value)
      )
    );
    
    multiplier.receive({ tag: 'a', value: 4 });
    multiplier.receive({ tag: 'b', value: 7 });
    expect(results).toEqual([28]);
    
    multiplier.receive({ tag: 'a', value: 5 });
    expect(results).toEqual([28, 35]);
  });

  it('should reset when configured', () => {
    const results: number[] = [];
    
    const summer = createGadget(
      semanticAccumulator<
        { x: number; y: number },
        number
      >(
        ['x', 'y'],
        ({ x, y }) => x + y,
        (value) => results.push(value),
        { reset: true }
      )
    );
    
    summer.receive({ tag: 'x', value: 2 });
    summer.receive({ tag: 'y', value: 3 });
    expect(results).toEqual([5]);
    
    // After reset, needs both again
    summer.receive({ tag: 'x', value: 10 });
    expect(results).toEqual([5]); // No fire
    
    summer.receive({ tag: 'y', value: 20 });
    expect(results).toEqual([5, 30]);
  });
});

describe('Bridge Patterns', () => {
  
  it('should bridge between value and message gadgets', () => {
    const results: any[] = [];
    
    // Value gadget
    const valueGadget: Gadget<number> = {
      receive(value: number): void {
        results.push({ type: 'value', data: value });
      }
    };
    
    // Message gadget
    const messageGadget: Gadget<Message<number>> = {
      receive(msg: Message<number>): void {
        results.push({ type: 'message', data: msg });
      }
    };
    
    // Bridge value -> message
    const bridged = bridge('sensor', messageGadget);
    bridged.receive(42);
    expect(results[0]).toEqual({
      type: 'message',
      data: { tag: 'sensor', value: 42 }
    });
    
    // Unbridge message -> value
    const unbridged = unbridge('sensor', valueGadget);
    unbridged.receive({ tag: 'sensor', value: 99 });
    expect(results[1]).toEqual({
      type: 'value',
      data: 99
    });
    
    // Wrong tag - filtered out
    unbridged.receive({ tag: 'other', value: 100 });
    expect(results.length).toBe(2);
  });
});

describe('Semantic Pool Routing', () => {
  
  it('should route messages based on semantic declarations', () => {
    const results: any[] = [];
    
    const pool = createGadget(semanticPool());
    
    // Create consumer gadgets
    const tempConsumer: Gadget<Message> = {
      receive(msg: Message): void {
        results.push({ consumer: 'temp', msg });
      }
    };
    
    const humidityConsumer: Gadget<Message> = {
      receive(msg: Message): void {
        results.push({ consumer: 'humidity', msg });
      }
    };
    
    // Register consumers
    pool.receive(declare.needs('temp-consumer', ['temperature'], tempConsumer));
    pool.receive(declare.needs('humidity-consumer', ['humidity'], humidityConsumer));
    
    // Register providers (without gadget refs - pool will route)
    pool.receive(declare.provides('sensor1', ['temperature']));
    pool.receive(declare.provides('sensor2', ['humidity']));
    
    // Send messages through pool
    pool.receive({ tag: 'temperature', value: 25 });
    pool.receive({ tag: 'humidity', value: 60 });
    pool.receive({ tag: 'temperature', value: 30 });
    
    expect(results).toEqual([
      { consumer: 'temp', msg: { tag: 'temperature', value: 25, from: 'sensor1' } },
      { consumer: 'humidity', msg: { tag: 'humidity', value: 60, from: 'sensor2' } },
      { consumer: 'temp', msg: { tag: 'temperature', value: 30, from: 'sensor1' } }
    ]);
  });

  it('should support multiple providers and consumers', () => {
    const results: string[] = [];
    
    const pool = createGadget(semanticPool());
    
    // Multiple consumers for same tag
    const display1: Gadget<Message> = {
      receive(msg: Message): void {
        results.push(`display1: ${msg.value}`);
      }
    };
    
    const display2: Gadget<Message> = {
      receive(msg: Message): void {
        results.push(`display2: ${msg.value}`);
      }
    };
    
    pool.receive(declare.needs('display1', ['data'], display1));
    pool.receive(declare.needs('display2', ['data'], display2));
    pool.receive(declare.provides('source', ['data']));
    
    // Both consumers receive the message
    pool.receive({ tag: 'data', value: 'test' });
    
    expect(results).toEqual([
      'display1: test',
      'display2: test'
    ]);
  });
});