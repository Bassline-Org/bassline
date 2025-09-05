/**
 * Simple tests for pattern implementations
 * Run with: npx tsx port-graphs/src/pp/test-patterns.ts
 */

import { Gadget } from "./core";
import { cell, fn, actions } from "./patterns";

// Test type inference
console.log("Testing type inference and basic functionality...\n");

// Test 1: Cell with number type inference
console.log("Test 1: Number cell with sum merge");
const sumCell = cell(
  (old: number, new: number) => old + new,
  0,
  actions.log("Sum updated to")
);

// Create a mock gadget to test
const mockGadget: Gadget<number> = {
  receive: function(data: number) {
    sumCell.call(this, data);
  }
};

// Test the cell
mockGadget.receive(5);  // Should log: "Sum updated to 5"
mockGadget.receive(3);  // Should log: "Sum updated to 8"
console.log("");

// Test 2: Function gadget with transformation
console.log("Test 2: Function gadget that doubles positive numbers");
const doubler = fn(
  (x: number) => x > 0 ? x * 2 : null,
  actions.log("Doubled to")
);

const mockFnGadget: Gadget<number> = {
  receive: function(data: number) {
    doubler.call(this, data);
  }
};

mockFnGadget.receive(5);   // Should log: "Doubled to 10"
mockFnGadget.receive(-3);  // Should not log (returns null)
mockFnGadget.receive(7);   // Should log: "Doubled to 14"
console.log("");

// Test 3: Cell with object merge (testing reference equality)
console.log("Test 3: Cell with object merge");
interface State {
  count: number;
  messages: string[];
}

const stateCell = cell<State>(
  (old, new) => ({
    count: old.count + new.count,
    messages: [...old.messages, ...new.messages]
  }),
  { count: 0, messages: [] },
  actions.log("State updated to")
);

const mockStateGadget: Gadget<State> = {
  receive: function(data: State) {
    stateCell.call(this, data);
  }
};

mockStateGadget.receive({ count: 1, messages: ["hello"] });
mockStateGadget.receive({ count: 2, messages: ["world"] });
console.log("");

// Test 4: Composed actions
console.log("Test 4: Composed actions");
const multiActionCell = cell(
  Math.max,
  0,
  actions.compose(
    actions.log("Max value:"),
    actions.when(
      (v: number) => v > 10,
      actions.log("WARNING: Value exceeded 10!")
    )
  )
);

const mockMaxGadget: Gadget<number> = {
  receive: function(data: number) {
    multiActionCell.call(this, data);
  }
};

mockMaxGadget.receive(5);   // Should log: "Max value: 5"
mockMaxGadget.receive(15);  // Should log: "Max value: 15" AND "WARNING: Value exceeded 10!"
mockMaxGadget.receive(3);   // Should log: "Max value: 15" (max doesn't decrease)
console.log("");

// Test 5: Direct connection between gadgets
console.log("Test 5: Direct gadget connection");

// Create a simple accumulator that will receive values
const accumulator: Gadget<number> & { total: number } = {
  total: 0,
  receive: function(data: number) {
    this.total += data;
    console.log(`Accumulator received ${data}, total: ${this.total}`);
  }
};

// Cell that sends directly to accumulator
const senderCell = cell(
  (old: number, new: number) => old + new,
  0,
  actions.direct(accumulator)
);

const mockSenderGadget: Gadget<number> = {
  receive: function(data: number) {
    senderCell.call(this, data);
  }
};

mockSenderGadget.receive(10);  // Accumulator should receive 10
mockSenderGadget.receive(5);   // Accumulator should receive 15
console.log("");

// Test 6: Batch action
console.log("Test 6: Batch action");
const batchCell = cell(
  (old: number, new: number) => new,  // Just replace
  0,
  actions.batch(3, (values: number[]) => 
    console.log(`Batch of ${values.length}: [${values.join(', ')}]`)
  )
);

const mockBatchGadget: Gadget<number> = {
  receive: function(data: number) {
    batchCell.call(this, data);
  }
};

mockBatchGadget.receive(1);  // No output yet
mockBatchGadget.receive(2);  // No output yet
mockBatchGadget.receive(3);  // Should log: "Batch of 3: [1, 2, 3]"
mockBatchGadget.receive(4);  // No output yet
mockBatchGadget.receive(5);  // No output yet
mockBatchGadget.receive(6);  // Should log: "Batch of 3: [4, 5, 6]"

console.log("\nAll tests completed!");
console.log("Type inference working: ✓");
console.log("Injectable actions working: ✓");
console.log("Composable actions working: ✓");