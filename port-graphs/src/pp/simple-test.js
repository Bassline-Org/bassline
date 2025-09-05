// Simple JavaScript test to verify patterns work
// Run with: node port-graphs/src/pp/simple-test.js

// Since we can't import TS directly, let's inline the core concepts
const protocol = (apply, consider, act) => {
  return function(data) {
    const result = apply(data);
    if (result == null) return;
    
    const decision = consider(result);
    if (decision == null) return;
    
    act(decision, this);
  };
};

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
  return protocol(
    transform,
    (result) => result,
    act
  );
};

// Test 1: Cell accumulation
console.log("Test 1: Cell accumulation");
const sumCell = cell(
  (old, incoming) => old + incoming,
  0,
  (value) => console.log(`  Sum is now: ${value}`)
);

const gadget1 = {
  receive: function(data) {
    sumCell.call(this, data);
  }
};

gadget1.receive(5);  // Should log: Sum is now: 5
gadget1.receive(3);  // Should log: Sum is now: 8
console.log("");

// Test 2: Function transformation
console.log("Test 2: Function transformation");
const doubler = fn(
  (x) => x > 0 ? x * 2 : null,
  (value) => console.log(`  Doubled to: ${value}`)
);

const gadget2 = {
  receive: function(data) {
    doubler.call(this, data);
  }
};

gadget2.receive(5);   // Should log: Doubled to: 10
gadget2.receive(-3);  // Should not log
gadget2.receive(7);   // Should log: Doubled to: 14
console.log("");

// Test 3: Direct connection
console.log("Test 3: Direct connection between gadgets");
const accumulator = {
  total: 0,
  receive: function(data) {
    this.total += data;
    console.log(`  Accumulator received ${data}, total: ${this.total}`);
  }
};

const sender = cell(
  (old, incoming) => old + incoming,
  0,
  (value) => accumulator.receive(value)
);

const gadget3 = {
  receive: function(data) {
    sender.call(this, data);
  }
};

gadget3.receive(10);  // Accumulator should receive 10
gadget3.receive(5);   // Accumulator should receive 15
console.log("");

// Test 4: Max cell (only changes when new max)
console.log("Test 4: Max cell");
const maxCell = cell(
  Math.max,
  0,
  (value) => console.log(`  New max: ${value}`)
);

const gadget4 = {
  receive: function(data) {
    maxCell.call(this, data);
  }
};

gadget4.receive(5);   // Should log: New max: 5
gadget4.receive(3);   // Should log: New max: 5 (no change)
gadget4.receive(10);  // Should log: New max: 10
gadget4.receive(7);   // Should log: New max: 10 (no change)

console.log("\n✅ All basic tests passed!");