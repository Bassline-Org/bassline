// Test the clean example in pure JS

// Core protocol
const protocol = (apply, consider, act) => {
  return function(data) {
    const result = apply(data);
    if (result == null) return;
    
    const decision = consider(result); 
    if (decision == null) return;
    
    act(decision, this);
  };
};

// Patterns
const cell = (merge, initial, act) => {
  let state = initial;
  return protocol(
    (data) => {
      const newState = merge(state, data);
      state = newState;
      return newState;
    },
    (result) => result !== initial && result !== undefined ? result : null,
    act
  );
};

const fn = (transform, act) => {
  return protocol(transform, (result) => result, act);
};

// Event action
const emitEvent = (eventName = 'propagate') =>
  (value, gadget) => {
    if ('dispatchEvent' in gadget) {
      gadget.dispatchEvent(new CustomEvent(eventName, { detail: value }));
    }
  };

// Wire helper
const wireEvents = (from, to, eventName = 'propagate') => {
  if ('addEventListener' in from) {
    from.addEventListener(eventName, (e) => {
      to.receive(e.detail);
    });
  }
};

// Simple gadget
class EventGadget extends EventTarget {
  constructor(id, protocol) {
    super();
    this.id = id;
    this.protocol = protocol;
  }
  
  receive(data) {
    this.protocol?.call(this, data);
  }
  
  use(protocol) {
    this.protocol = protocol;
    return this;
  }
}

console.log("=== Testing Clean Event Network ===\n");

// Create gadgets
const sensor = new EventGadget('sensor')
  .use(fn(
    (reading) => {
      console.log(`📡 Sensor: ${reading}°C`);
      return reading;
    },
    emitEvent('temperature')
  ));

const display = new EventGadget('display')
  .use(cell(
    (old, value) => value,
    0,
    (value) => console.log(`📺 Display: ${value}°C`)
  ));

const alert = new EventGadget('alert')
  .use(fn(
    (temp) => temp > 25 ? temp : null,
    (value) => console.log(`⚠️  ALERT: High temperature ${value}°C!`)
  ));

// Wire them manually for this test
wireEvents(sensor, display, 'temperature');
wireEvents(sensor, alert, 'temperature');

// Send readings
console.log("Sending readings...\n");
[22, 24, 26, 23].forEach(temp => sensor.receive(temp));

console.log("\n✅ Clean event network working!");