/**
 * Test that type inference works correctly with the new typed approach
 */

import { maxCell, minCell, lastCell, unionCell } from '../patterns/cells/typed-cells';
import { adder, multiplier } from '../patterns/functions/typed-functions';

// Test cell type inference
function testCells() {
  // Numeric cells don't need initial values
  const max = maxCell(10);
  const min = minCell(5);

  // These should work
  max.receive(20);
  min.receive(3);

  // TypeScript should know the types
  const maxValue = max.current();
  const minValue = min.current();

  // Generic cells infer from initial value
  const lastString = lastCell("hello");
  lastString.receive("world");
  const str = lastString.current();

  const lastNumber = lastCell(42);
  lastNumber.receive(100);
  const num = lastNumber.current();

  // Set cells
  const union = unionCell(new Set([1, 2, 3]));
  union.receive(new Set([3, 4, 5]));
  const set: Set<number> = union.current();

  // These should error if uncommented:
  // max.receive("wrong");  // Error: string not assignable to number
  // lastString.receive(123);  // Error: number not assignable to string
  // const wrong: string = max.current();  // Error: number not assignable to string
}

// Test function type inference
function testFunctions() {
  const add = adder({});
  const mult = multiplier({});

  // Partial application
  add.receive({ a: 5 });
  add.receive({ b: 3 });

  // Full application
  mult.receive({ a: 4, b: 7 });

  // Get results - TypeScript knows the types
  const sumState = add.current();
  const result = sumState.result;  // number | undefined

  // These should error if uncommented:
  // add.receive({ c: 10 });  // Error: 'c' not in {a, b}
  // add.receive({ a: "wrong" });  // Error: string not assignable to number
}

// Run the tests
testCells();
testFunctions();

console.log("Type inference tests pass! ✓");