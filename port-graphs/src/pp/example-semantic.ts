/**
 * Example demonstrating unified semantic routing with messages
 * 
 * Everything uses the same Message type and semantic tags.
 * No special cases for multi-arg functions.
 */

import { Gadget } from "./core";
import { fn, cell, actions } from "./patterns";
import { Message, fromValue, toValue, filterTag, mapMessage } from "./message";
import { semanticAccumulator, bridge, unbridge } from "./semantic";
import { semanticPool, declare } from "./semantic-pool";

console.log("=== Unified Semantic Routing Example ===\n");

// Create a simple gadget wrapper helper
function createGadget<T>(protocol: (this: Gadget<T>, data: T) => void): Gadget<T> {
  const gadget: Gadget<T> = {
    receive(data: T): void {
      protocol.call(gadget, data);
    }
  };
  return gadget;
}

// Create the semantic pool (message router)
const pool = createGadget(semanticPool());

console.log("Phase 1: Creating sensor gadgets...\n");

// Temperature sensor - emits messages with 'temperature' tag
const tempSensor = createGadget(
  fromValue<number>(
    'temperature',
    (msg) => {
      console.log(`🌡️  Sensor: ${msg.value}°C → tag:'${msg.tag}'`);
      pool.receive(msg);  // Send to pool for routing
    }
  )
);

// Humidity sensor - emits messages with 'humidity' tag  
const humiditySensor = createGadget(
  fromValue<number>(
    'humidity',
    (msg) => {
      console.log(`💧 Sensor: ${msg.value}% → tag:'${msg.tag}'`);
      pool.receive(msg);
    }
  )
);

console.log("Phase 2: Creating processing gadgets...\n");

// Heat index calculator - needs temperature AND humidity
const heatIndexCalc = createGadget(
  semanticAccumulator<
    { temperature: number; humidity: number },
    number
  >(
    ['temperature', 'humidity'],
    ({ temperature, humidity }) => {
      const heatIndex = temperature + humidity * 0.1;
      console.log(`\n🔥 Heat Index: ${heatIndex.toFixed(1)}°C`);
      console.log(`   (temp: ${temperature}°C, humidity: ${humidity}%)`);
      return heatIndex;
    },
    (value) => {
      // Emit result as new message
      pool.receive({ tag: 'heat-index', value });
    }
  )
);

// High temperature alert - filters for high temps
const highTempAlert = createGadget(
  filterTag<number>(
    'temperature',
    (msg) => {
      if (msg.value > 25) {
        console.log(`⚠️  ALERT: High temperature ${msg.value}°C!`);
      }
    }
  )
);

// Comfort monitor - processes heat index
const comfortMonitor = createGadget(
  filterTag<number>(
    'heat-index',
    (msg) => {
      const comfort = msg.value < 27 ? 'Comfortable' : 
                      msg.value < 32 ? 'Uncomfortable' : 
                      'Very Uncomfortable';
      console.log(`😊 Comfort: ${comfort} (heat index: ${msg.value}°C)\n`);
    }
  )
);

console.log("Phase 3: Registering semantic connections...\n");

// Register what each gadget provides/needs
pool.receive(declare.provides('temp-sensor', ['temperature']));
pool.receive(declare.provides('humidity-sensor', ['humidity']));
pool.receive(declare.provides('heat-index', ['heat-index']));

pool.receive(declare.needs('heat-index-calc', ['temperature', 'humidity'], heatIndexCalc));
pool.receive(declare.needs('high-temp-alert', ['temperature'], highTempAlert));
pool.receive(declare.needs('comfort-monitor', ['heat-index'], comfortMonitor));

console.log("\nPhase 4: Sending data through the network...\n");

// Example: Bridge pattern for legacy gadgets
const legacyDisplay: Gadget<number> = {
  receive(value: number): void {
    console.log(`📺 Legacy Display: ${value}`);
  }
};

// Bridge legacy gadget to message world
const bridgedDisplay = unbridge('heat-index', legacyDisplay);
pool.receive(declare.needs('legacy-display', ['heat-index'], bridgedDisplay));

// Send sensor data - everything flows as messages
console.log("--- Reading 1 ---");
tempSensor.receive(22);
humiditySensor.receive(60);

setTimeout(() => {
  console.log("\n--- Reading 2 ---");
  tempSensor.receive(28);  // Triggers high temp alert
  humiditySensor.receive(70);
}, 500);

setTimeout(() => {
  console.log("\n--- Reading 3 ---");
  tempSensor.receive(32);  // Very high temp
  humiditySensor.receive(85);
}, 1000);

setTimeout(() => {
  console.log("\n✅ Semantic routing demonstration complete!");
  console.log("\nKey insights:");
  console.log("- Everything uses Messages with semantic tags");
  console.log("- No special multi-arg gadgets needed");
  console.log("- Pool routes messages, doesn't mutate gadgets");
  console.log("- Legacy gadgets work via bridge/unbridge adapters");
  console.log("- All adapters are just fn transformers");
}, 1500);