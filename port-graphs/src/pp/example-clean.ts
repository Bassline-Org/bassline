/**
 * Clean example using event-based gadgets with pool wiring
 */

import { cell, fn } from "./patterns";
import { createPool, assert, Assertion } from "./pool";
import { EventfulGadget, emitEvent, wireEvents } from "./event-gadget";

console.log("=== Self-Organizing Temperature Network ===\n");

// Temperature sensor - pure function that emits events
const sensor = new EventfulGadget<number>('sensor')
  .use(fn(
    (reading: number) => {
      console.log(`📡 Sensor: ${reading}°C`);
      return reading;
    },
    emitEvent('temperature')
  ));

// Converter - transforms celsius to fahrenheit
const converter = new EventfulGadget<number>('converter')  
  .use(fn(
    (celsius: number) => {
      const fahrenheit = (celsius * 9/5) + 32;
      console.log(`🔄 Converter: ${fahrenheit}°F`);
      return fahrenheit;
    },
    emitEvent('fahrenheit')
  ));

// Alert - only acts on high temperatures
const alert = new EventfulGadget<number>('alert')
  .use(fn(
    (temp: number) => temp > 25 ? temp : null,
    (value) => console.log(`⚠️  ALERT: High temperature ${value}°C!`)
  ));

// Display - shows current temperature
const display = new EventfulGadget<number>('display')
  .use(cell(
    (_old, value) => value, // Replace with latest
    0,
    (value) => console.log(`📺 Display: ${value}°C\n`)
  ));

// Pool that wires gadgets based on assertions
const pool = new EventfulGadget<Assertion>('pool')
  .use(createPool((match) => {
    console.log(`🔌 Wiring: ${match.provider.id} → ${match.consumer.id}`);
    if (match.provider.gadget && match.consumer.gadget) {
      wireEvents(
        match.provider.gadget as EventfulGadget<number>, 
        match.consumer.gadget as EventfulGadget<number>, 
        'temperature'
      );
    }
  }));

// Phase 1: Gadgets announce capabilities
console.log("Phase 1: Announcing capabilities...\n");

pool.receive(assert.provides('sensor', 'temperature', sensor));
pool.receive(assert.needs('converter', 'temperature', converter));
pool.receive(assert.needs('alert', 'temperature', alert));
pool.receive(assert.needs('display', 'temperature', display));

// Phase 2: Send data through the network
console.log("\nPhase 2: Sending readings...\n");

const readings = [22, 24, 26, 23];
readings.forEach((temp, i) => {
  setTimeout(() => {
    sensor.receive(temp);
  }, i * 500);
});

setTimeout(() => {
  console.log("✅ Network self-organized and processed data!");
}, readings.length * 500 + 100);