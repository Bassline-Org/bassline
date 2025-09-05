/**
 * Integration tests showing actual usage of our patterns
 */

import { describe, it, expect } from 'vitest';
import { cell, fn } from "./patterns";
import { createPool, assert } from "./pool";
import { EventfulGadget, emitEvent, wireEvents } from "./event-gadget";

describe('Integration Tests', () => {
  it('should propagate through event-based gadgets', () => {
    const results: any[] = [];
    
    // Create a sensor that emits events
    const sensor = new EventfulGadget<number>('sensor')
      .use(fn(
        (reading: number) => reading * 2, // Double the reading
        emitEvent('data')
      ));
    
    // Create a display that collects values
    const display = new EventfulGadget<number>('display')
      .use(cell(
        (_old, value) => value,
        0,
        (value) => results.push(value)
      ));
    
    // Wire them together
    wireEvents(sensor, display, 'data');
    
    // Send data
    sensor.receive(10);
    sensor.receive(20);
    
    expect(results).toEqual([20, 40]);
  });

  it('should handle conditional propagation', () => {
    const alerts: number[] = [];
    
    // Alert only on high values
    const alertGadget = new EventfulGadget<number>('alert')
      .use(fn(
        (value: number) => value > 25 ? value : null,
        (value) => alerts.push(value)
      ));
    
    alertGadget.receive(20); // Should not alert
    alertGadget.receive(30); // Should alert
    alertGadget.receive(10); // Should not alert
    alertGadget.receive(40); // Should alert
    
    expect(alerts).toEqual([30, 40]);
  });

  it('should self-organize network through pool', () => {
    const results: string[] = [];
    
    // Create gadgets
    const producer = new EventfulGadget<string>('producer')
      .use(fn(
        (msg: string) => `[${msg}]`,
        emitEvent('message')
      ));
    
    const consumer = new EventfulGadget<string>('consumer')
      .use(fn(
        (msg: string) => msg,
        (value) => results.push(value)
      ));
    
    // Create pool with wiring action
    const pool = new EventfulGadget<any>('pool')
      .use(createPool((match) => {
        wireEvents(match.provider.gadget, match.consumer.gadget, 'message');
      }));
    
    // Announce capabilities - network self-organizes
    pool.receive(assert.provides('producer', 'messages', producer));
    pool.receive(assert.needs('consumer', 'messages', consumer));
    
    // Send data through the network
    producer.receive('hello');
    producer.receive('world');
    
    expect(results).toEqual(['[hello]', '[world]']);
  });

  it('should accumulate values in cells', () => {
    const sums: number[] = [];
    
    const accumulator = new EventfulGadget<number>('accumulator')
      .use(cell(
        (old, incoming) => old + incoming,
        0,
        (value) => sums.push(value)
      ));
    
    accumulator.receive(5);  // 0 + 5 = 5
    accumulator.receive(3);  // 5 + 3 = 8
    accumulator.receive(7);  // 8 + 7 = 15
    
    expect(sums).toEqual([5, 8, 15]);
  });

  it('should chain multiple transformations', () => {
    const results: number[] = [];
    
    // Double
    const doubler = new EventfulGadget<number>('doubler')
      .use(fn(
        (x: number) => x * 2,
        emitEvent('doubled')
      ));
    
    // Add 10
    const adder = new EventfulGadget<number>('adder')
      .use(fn(
        (x: number) => x + 10,
        emitEvent('added')
      ));
    
    // Collect
    const collector = new EventfulGadget<number>('collector')
      .use(fn(
        (x: number) => x,
        (value) => results.push(value)
      ));
    
    // Wire them in sequence
    wireEvents(doubler, adder, 'doubled');
    wireEvents(adder, collector, 'added');
    
    doubler.receive(5);   // 5 * 2 = 10, 10 + 10 = 20
    doubler.receive(10);  // 10 * 2 = 20, 20 + 10 = 30
    
    expect(results).toEqual([20, 30]);
  });

  it('should handle multiple consumers from one producer', () => {
    const displays: number[] = [];
    const logs: number[] = [];
    const alerts: number[] = [];
    
    // Producer
    const sensor = new EventfulGadget<number>('sensor')
      .use(fn(
        (reading: number) => reading,
        emitEvent('temperature')
      ));
    
    // Multiple consumers
    const display = new EventfulGadget<number>('display')
      .use(fn(
        (value: number) => value,
        (v) => displays.push(v)
      ));
    
    const logger = new EventfulGadget<number>('logger')
      .use(fn(
        (value: number) => value,
        (v) => logs.push(v)
      ));
    
    const alerter = new EventfulGadget<number>('alerter')
      .use(fn(
        (value: number) => value > 25 ? value : null,
        (v) => alerts.push(v)
      ));
    
    // Wire all consumers to the producer
    wireEvents(sensor, display, 'temperature');
    wireEvents(sensor, logger, 'temperature');
    wireEvents(sensor, alerter, 'temperature');
    
    // Send data
    sensor.receive(22);
    sensor.receive(28);
    
    expect(displays).toEqual([22, 28]);
    expect(logs).toEqual([22, 28]);
    expect(alerts).toEqual([28]); // Only high temperature
  });
});