/**
 * Weather calculation example using semantic multi-argument functions
 * 
 * This demonstrates how the Pool pattern enables multi-argument functions
 * through semantic binding rather than manual wiring.
 */

import { fn } from "./patterns";
import { createPool, assert, Assertion } from "./pool";
import { EventfulGadget, emitEvent, wireEvents } from "./event-gadget";
import { multiNeedsGadget, TaggedValue } from "./pool-multi";

console.log("=== Weather Calculation Network ===\n");

// Create the pool for semantic wiring
const pool = new EventfulGadget<Assertion>('pool')
  .use(createPool((match) => {
    console.log(`🔌 Wiring: ${match.provider.id} → ${match.consumer.id} for "${match.tag}"`);
    
    // Wire providers to consumers using tagged values
    if (match.provider.gadget && match.consumer.gadget) {
      const provider = match.provider.gadget as EventfulGadget<unknown>;
      const consumer = match.consumer.gadget as EventfulGadget<TaggedValue>;
      const tag = match.tag;
      
      // When provider emits, wrap in tagged value for consumer
      provider.addEventListener(tag, (e: Event) => {
        const value = (e as CustomEvent).detail;
        consumer.receive({ tag, value });
      });
    }
  }));

console.log("Phase 1: Creating sensors...\n");

// Temperature sensor - provides "temperature"
const tempSensor = new EventfulGadget<number>('temp-sensor')
  .use(fn(
    (celsius: number) => {
      console.log(`🌡️  Temperature: ${celsius}°C`);
      return celsius;
    },
    emitEvent('temperature')
  ));

// Humidity sensor - provides "humidity"
const humiditySensor = new EventfulGadget<number>('humidity-sensor')
  .use(fn(
    (percent: number) => {
      console.log(`💧 Humidity: ${percent}%`);
      return percent;
    },
    emitEvent('humidity')
  ));

// Pressure sensor - provides "pressure"
const pressureSensor = new EventfulGadget<number>('pressure-sensor')
  .use(fn(
    (hPa: number) => {
      console.log(`🎯 Pressure: ${hPa} hPa`);
      return hPa;
    },
    emitEvent('pressure')
  ));

console.log("Phase 2: Creating multi-input calculators...\n");

// Heat index calculator - needs temperature and humidity
const heatIndexCalc = multiNeedsGadget<
  { temperature: number; humidity: number },
  number
>(
  'heat-index-calc',
  ['temperature', 'humidity'],
  ({ temperature, humidity }) => {
    // Simplified heat index formula
    const heatIndex = temperature + (humidity * 0.1);
    console.log(`\n🔥 Heat Index calculated: ${heatIndex.toFixed(1)}°C`);
    console.log(`   (from temp: ${temperature}°C, humidity: ${humidity}%)`);
    return heatIndex;
  },
  emitEvent('heat-index'),
  { provides: 'heat-index', reset: false }  // Don't reset - maintain state
);

// Weather comfort score - needs all three inputs
const comfortScore = multiNeedsGadget<
  { temperature: number; humidity: number; pressure: number },
  number
>(
  'comfort-score',
  ['temperature', 'humidity', 'pressure'],
  ({ temperature, humidity, pressure }) => {
    // Calculate comfort score (0-100)
    let score = 100;
    
    // Temperature penalty (ideal is 22°C)
    score -= Math.abs(temperature - 22) * 2;
    
    // Humidity penalty (ideal is 50%)
    score -= Math.abs(humidity - 50) * 0.5;
    
    // Pressure bonus/penalty (ideal is 1013 hPa)
    score -= Math.abs(pressure - 1013) * 0.1;
    
    score = Math.max(0, Math.min(100, score));
    
    console.log(`\n😊 Comfort Score: ${score.toFixed(1)}/100`);
    console.log(`   (temp: ${temperature}°C, humidity: ${humidity}%, pressure: ${pressure} hPa)`);
    return score;
  },
  emitEvent('comfort'),
  { provides: 'comfort', reset: false }  // Don't reset - maintain state
);

// Display for heat index
const heatIndexDisplay = new EventfulGadget<TaggedValue>('heat-index-display')
  .use(fn(
    (data: TaggedValue) => {
      if (data.tag === 'heat-index') {
        console.log(`📊 Heat Index Display: ${data.value}°C apparent temperature\n`);
      }
      return null;
    },
    () => {}
  ));

console.log("Phase 3: Registering with pool...\n");

// Register sensors as providers
pool.receive(assert.provides('temp-sensor', 'temperature', tempSensor));
pool.receive(assert.provides('humidity-sensor', 'humidity', humiditySensor));
pool.receive(assert.provides('pressure-sensor', 'pressure', pressureSensor));

// Register calculators with their needs
heatIndexCalc.registerWith(pool);
comfortScore.registerWith(pool);

// Register display as consumer
pool.receive(assert.needs('heat-index-display', 'heat-index', heatIndexDisplay));

console.log("\nPhase 4: Sending sensor data...\n");
console.log("(Notice how calculators fire EVERY TIME any input changes)\n");

// Send data from sensors - they can arrive in any order!
setTimeout(() => {
  console.log("--- Reading 1 ---");
  tempSensor.receive(25);
}, 100);

setTimeout(() => {
  humiditySensor.receive(65);
}, 200);

setTimeout(() => {
  pressureSensor.receive(1015);
}, 300);

// Second reading
setTimeout(() => {
  console.log("\n--- Reading 2 ---");
  tempSensor.receive(28);
  humiditySensor.receive(75);
  pressureSensor.receive(1010);
}, 800);

// Third reading - demonstrating partial updates
setTimeout(() => {
  console.log("\n--- Reading 3 (partial update) ---");
  tempSensor.receive(30);
  // Only temperature updated - heat index will recalculate
  // but comfort score waits for all three
}, 1300);

setTimeout(() => {
  humiditySensor.receive(80);
  // Now heat index fires again
}, 1400);

setTimeout(() => {
  pressureSensor.receive(1008);
  // Now comfort score fires with all three
}, 1500);

setTimeout(() => {
  console.log("\n✅ Weather network demonstration complete!");
  console.log("\nKey observations:");
  console.log("- Sensors don't know about calculators");
  console.log("- Calculators don't know about sensors");
  console.log("- Pool wires everything based on semantic tags");
  console.log("- Multi-arg functions fire only when all inputs ready");
  console.log("- Inputs can arrive in any order");
}, 2000);