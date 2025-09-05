/**
 * Example: Self-organizing temperature monitoring network
 * 
 * This example shows how Pool gadgets enable self-wiring networks
 * where components discover each other through semantic assertions.
 */

import { Gadget } from "./core";
import { cell, fn, actions } from "./patterns";
import { createPool, assert, poolActions } from "./pool";

// Run with: node port-graphs/src/pp/example-temperature-network.js
// (After transpiling or using ts-node)

console.log("🌡️  Temperature Monitoring Network Example\n");
console.log("This network self-organizes through semantic discovery.\n");

// Create the pool that will manage topology
const pool = createPool(poolActions.logMatch());

const poolGadget: Gadget<any> = {
  receive: function(data: any) {
    pool.call(this, data);
  }
};

// Storage for values (simulating a database or state store)
const storage: number[] = [];

// === Temperature Sensor Gadget ===
// Simulates a sensor that produces temperature readings
const tempSensor = (() => {
  let temperature = 20; // Starting temperature
  
  const sensor = cell(
    (old: number, incoming: number) => incoming, // Just replace
    temperature,
    (value, gadget) => {
      console.log(`🌡️  Sensor: Temperature is ${value}°C`);
      // Propagate to any connected gadgets
      if ((gadget as any).connections) {
        (gadget as any).connections.forEach((target: Gadget<number>) => {
          target.receive(value);
        });
      }
    }
  );

  const gadget: Gadget<number> & { connections?: Gadget<number>[] } = {
    connections: [],
    receive: function(data: number) {
      sensor.call(this, data);
    }
  };

  return gadget;
})();

// === Celsius to Fahrenheit Converter ===
const celsiusToFahrenheit = (() => {
  const converter = fn(
    (celsius: number) => (celsius * 9/5) + 32,
    (fahrenheit, gadget) => {
      console.log(`🔄  Converter: ${fahrenheit}°F`);
      if ((gadget as any).connections) {
        (gadget as any).connections.forEach((target: Gadget<number>) => {
          target.receive(fahrenheit);
        });
      }
    }
  );

  const gadget: Gadget<number> & { connections?: Gadget<number>[] } = {
    connections: [],
    receive: function(data: number) {
      converter.call(this, data);
    }
  };

  return gadget;
})();

// === High Temperature Alert ===
const highTempAlert = (() => {
  const alerter = fn(
    (temp: number) => temp > 25 ? `⚠️  HIGH TEMPERATURE: ${temp}°C` : null,
    (alert) => console.log(alert)
  );

  const gadget: Gadget<number> = {
    receive: function(data: number) {
      alerter.call(this, data);
    }
  };

  return gadget;
})();

// === Temperature Logger ===
// Note: This is a bit tricky - we want to receive numbers but accumulate an array
// So we need a custom protocol that handles the type mismatch
const tempLogger = (() => {
  let readings: number[] = [];
  
  const gadget: Gadget<number> = {
    receive: function(data: number) {
      readings.push(data);
      console.log(`📊 Logger: Recorded ${readings.length} readings`);
      storage.push(data);
    }
  };

  return gadget;
})();

// === Temperature Display ===
const tempDisplay = (() => {
  const display = cell(
    (old: number, incoming: number) => incoming,
    0,
    (value) => {
      console.log(`📺 Display: Current temperature: ${value}°C`);
      console.log("─".repeat(40));
    }
  );

  const gadget: Gadget<number> = {
    receive: function(data: number) {
      display.call(this, data);
    }
  };

  return gadget;
})();

// Custom wiring action that actually connects gadgets
const wireGadgets = (match: any) => {
  console.log(`🔌 Wiring: ${match.provider.id} → ${match.consumer.id} [${match.tag}]`);
  
  if (match.provider.gadget && match.consumer.gadget) {
    // Add consumer to provider's connections
    if (!match.provider.gadget.connections) {
      match.provider.gadget.connections = [];
    }
    match.provider.gadget.connections.push(match.consumer.gadget);
  }
};

// Create pool with actual wiring
const wiringPool = createPool(wireGadgets);
const wiringPoolGadget: Gadget<any> = {
  receive: function(data: any) {
    wiringPool.call(this, data);
  }
};

console.log("=== PHASE 1: Gadgets Announce Capabilities ===\n");

// Gadgets announce what they provide and need
// This happens in any order - the pool figures out the connections

wiringPoolGadget.receive(assert.provides('sensor', 'temperature-celsius', tempSensor));
wiringPoolGadget.receive(assert.provides('converter', 'temperature-fahrenheit', celsiusToFahrenheit));

wiringPoolGadget.receive(assert.needs('converter', 'temperature-celsius', celsiusToFahrenheit));
wiringPoolGadget.receive(assert.needs('alert', 'temperature-celsius', highTempAlert));
wiringPoolGadget.receive(assert.needs('logger', 'temperature-celsius', tempLogger));
wiringPoolGadget.receive(assert.needs('display', 'temperature-celsius', tempDisplay));

console.log("\n=== PHASE 2: Network Self-Organized! ===\n");
console.log("The pool has automatically wired:");
console.log("  sensor → converter (for Fahrenheit)");
console.log("  sensor → alert (for high temp warnings)");
console.log("  sensor → logger (for recording)");
console.log("  sensor → display (for UI)\n");

console.log("=== PHASE 3: Running the Network ===\n");

// Simulate temperature changes
const readings = [22, 24, 26, 28, 25, 23];

readings.forEach((temp, i) => {
  setTimeout(() => {
    console.log(`\n⏰ Time ${i}: New reading...`);
    tempSensor.receive(temp);
  }, i * 1000);
});

setTimeout(() => {
  console.log("\n=== FINAL SUMMARY ===");
  console.log(`Total readings stored: ${storage.length}`);
  console.log("\n✅ Network operated successfully through semantic discovery!");
  console.log("No manual wiring was needed - topology emerged from assertions.");
}, readings.length * 1000 + 500);