/**
 * Calculator gadget - computes operations on multiple inputs
 */

import { createGadget } from '../../core';
import { changed, noop } from '../../effects';

interface CalculatorState {
  inputA: number | undefined;
  inputB: number | undefined;
  operation: 'add' | 'subtract' | 'multiply' | 'divide';
  result: number | undefined;
}

type CalculatorInput = {
  a?: number;
  b?: number;
  operation?: 'add' | 'subtract' | 'multiply' | 'divide';
};

const compute = (a: number, b: number, op: string): number => {
  switch (op) {
    case 'add': return a + b;
    case 'subtract': return a - b;
    case 'multiply': return a * b;
    case 'divide': return b !== 0 ? a / b : 0;
    default: return 0;
  }
};

export const calculatorGadget = (operation: 'add' | 'subtract' | 'multiply' | 'divide' = 'add') => {
  return createGadget<CalculatorState, CalculatorInput>(
    (state, input) => {
      // CONSIDER: What inputs changed and can we compute?
      const newA = input.a !== undefined ? input.a : state.inputA;
      const newB = input.b !== undefined ? input.b : state.inputB;
      const newOp = input.operation !== undefined ? input.operation : state.operation;

      // Something changed?
      const changed = newA !== state.inputA || newB !== state.inputB || newOp !== state.operation;

      if (changed) {
        // Can we compute?
        if (newA !== undefined && newB !== undefined) {
          return {
            action: 'compute',
            context: { a: newA, b: newB, operation: newOp }
          };
        } else {
          // Partial update, store but don't compute
          return {
            action: 'store',
            context: { a: newA, b: newB, operation: newOp }
          };
        }
      }

      return null;
    },
    {
      'compute': (gadget, context) => {
        const { a, b, operation } = context;
        const result = compute(a, b, operation);
        gadget.update({
          inputA: a,
          inputB: b,
          operation,
          result
        });
        return changed(result);
      },

      'store': (gadget, context) => {
        const { a, b, operation } = context;
        gadget.update({
          inputA: a,
          inputB: b,
          operation,
          result: undefined
        });
        return noop(); // Waiting for more inputs
      }
    })({ inputA: undefined, inputB: undefined, operation, result: undefined });
};