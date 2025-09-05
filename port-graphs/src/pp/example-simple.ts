/**
 * Simple example showing the core patterns
 */

import { cell, fn } from "./patterns";
import { createPool, assert, Assertion } from "./pool";
import { EventfulGadget, emitEvent, wireEvents } from "./event-gadget";

console.log("=== Simple Temperature Network ===\n");

// Temperature sensor - a FUNCTION that transforms readings
const sensor = new EventfulGadget<number>('sensor')
  .use(fn(
    (reading: number) => {
      console.log(`📡 Sensor reading: ${reading}°C`);
      return reading;
    },
    emitEvent('temperature')
  ));

// Converter - another FUNCTION that transforms celsius to fahrenheit  
const converter = new EventfulGadget<number>('converter')
  .use(fn(
    (celsius: number) => {
      const fahrenheit = (celsius * 9/5) + 32;
      console.log(`🔄 Converted: ${fahrenheit}°F`);
      return fahrenheit;
    },
    emitEvent('fahrenheit')
  ));

// Display - a CELL that accumulates the last value
const display = new EventfulGadget<number>('display')
  .use(cell(
    (_old, value) => value, // Just replace with new value
    0,
    (value) => console.log(`📺 Display: ${value}°C\n`)
  ));

// High temp alert - a FUNCTION that only acts on high temps
const alert = new EventfulGadget<number>('alert')
  .use(fn(
    (temp: number) => temp > 25 ? temp : null,
    (value) => console.log(`⚠️  ALERT: High temperature ${value}°C!\n`)
  ));

// Create pool with event wiring
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

// Gadgets announce capabilities
console.log("Phase 1: Announcing capabilities...\n");
pool.receive(assert.provides('sensor', 'temperature', sensor));
pool.receive(assert.needs('converter', 'temperature', converter));
pool.receive(assert.needs('display', 'temperature', display));
pool.receive(assert.needs('alert', 'temperature', alert));

console.log("\nPhase 2: Sending data...\n");

// Send some temperature readings
[22, 24, 26, 23].forEach((temp, i) => {
  setTimeout(() => {
    sensor.receive(temp);
  }, i * 500);
});

setTimeout(() => {
  console.log("✅ Network complete!");
}, 2500);