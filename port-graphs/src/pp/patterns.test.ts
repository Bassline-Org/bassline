/**
 * Tests for pattern implementations
 */

import { describe, it, expect, vi } from 'vitest';
import { Gadget } from "./core";
import { cell, fn, actions } from "./patterns";

describe('Gadget Patterns', () => {
  describe('cell', () => {
    it('should accumulate values with merge function', () => {
      const mockAction = vi.fn();
      const sumCell = cell(
        (old: number, incoming: number) => old + incoming,
        0,
        mockAction
      );

      const gadget: Gadget<number> = {
        receive: function(data: number) {
          sumCell.call(this, data);
        }
      };

      gadget.receive(5);
      expect(mockAction).toHaveBeenCalledWith(5, gadget);
      
      gadget.receive(3);
      expect(mockAction).toHaveBeenCalledWith(8, gadget);
      
      expect(mockAction).toHaveBeenCalledTimes(2);
    });

    it('should maintain type inference for complex types', () => {
      interface State {
        count: number;
        messages: string[];
      }

      const mockAction = vi.fn<[State, any], void>();
      const stateCell = cell<State>(
        (old, incoming) => ({
          count: old.count + incoming.count,
          messages: [...old.messages, ...incoming.messages]
        }),
        { count: 0, messages: [] },
        mockAction
      );

      const gadget: Gadget<State> = {
        receive: function(data: State) {
          stateCell.call(this, data);
        }
      };

      gadget.receive({ count: 1, messages: ["hello"] });
      expect(mockAction).toHaveBeenCalledWith(
        { count: 1, messages: ["hello"] },
        gadget
      );

      gadget.receive({ count: 2, messages: ["world"] });
      expect(mockAction).toHaveBeenCalledWith(
        { count: 3, messages: ["hello", "world"] },
        gadget
      );
    });

    it('should only act when value changes', () => {
      const mockAction = vi.fn();
      const maxCell = cell(
        Math.max,
        0,
        mockAction
      );

      const gadget: Gadget<number> = {
        receive: function(data: number) {
          maxCell.call(this, data);
        }
      };

      gadget.receive(5);
      expect(mockAction).toHaveBeenCalledTimes(1);
      expect(mockAction).toHaveBeenCalledWith(5, gadget);

      gadget.receive(3); // Max doesn't change (5 > 3)
      expect(mockAction).toHaveBeenCalledTimes(2);
      expect(mockAction).toHaveBeenLastCalledWith(5, gadget);
    });
  });

  describe('fn', () => {
    it('should transform values and act on non-null results', () => {
      const mockAction = vi.fn();
      const doubler = fn(
        (x: number) => x > 0 ? x * 2 : null,
        mockAction
      );

      const gadget: Gadget<number> = {
        receive: function(data: number) {
          doubler.call(this, data);
        }
      };

      gadget.receive(5);
      expect(mockAction).toHaveBeenCalledWith(10, gadget);

      gadget.receive(-3); // Returns null, should not act
      expect(mockAction).toHaveBeenCalledTimes(1);

      gadget.receive(7);
      expect(mockAction).toHaveBeenCalledWith(14, gadget);
      expect(mockAction).toHaveBeenCalledTimes(2);
    });

    it('should maintain type inference through transformation', () => {
      const mockAction = vi.fn<[string, any], void>();
      const stringifier = fn(
        (x: number) => x > 0 ? `Value: ${x}` : null,
        mockAction
      );

      const gadget: Gadget<number> = {
        receive: function(data: number) {
          stringifier.call(this, data);
        }
      };

      gadget.receive(42);
      expect(mockAction).toHaveBeenCalledWith("Value: 42", gadget);
    });
  });

  describe('actions', () => {
    it('none action should do nothing', () => {
      const noneAction = actions.none<number>();
      const gadget: Gadget<number> = { receive: vi.fn() };
      
      // Should not throw
      expect(() => noneAction(42, gadget)).not.toThrow();
    });

    it('log action should console.log', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const logAction = actions.log<number>("Test:");
      const gadget: Gadget<number> = { receive: vi.fn() };
      
      logAction(42, gadget);
      expect(consoleSpy).toHaveBeenCalledWith("Test:", 42);
      
      consoleSpy.mockRestore();
    });

    it('direct action should call target gadget', () => {
      const target: Gadget<number> = { receive: vi.fn() };
      const directAction = actions.direct(target);
      const source: Gadget<number> = { receive: vi.fn() };
      
      directAction(42, source);
      expect(target.receive).toHaveBeenCalledWith(42);
    });

    it('compose action should call multiple actions in order', () => {
      const order: number[] = [];
      const action1 = vi.fn(() => order.push(1));
      const action2 = vi.fn(() => order.push(2));
      const action3 = vi.fn(() => order.push(3));
      
      const composed = actions.compose(action1, action2, action3);
      const gadget: Gadget<number> = { receive: vi.fn() };
      
      composed(42, gadget);
      
      expect(action1).toHaveBeenCalledWith(42, gadget);
      expect(action2).toHaveBeenCalledWith(42, gadget);
      expect(action3).toHaveBeenCalledWith(42, gadget);
      expect(order).toEqual([1, 2, 3]);
    });

    it('when action should conditionally execute', () => {
      const mockAction = vi.fn();
      const conditionalAction = actions.when(
        (x: number) => x > 10,
        mockAction
      );
      const gadget: Gadget<number> = { receive: vi.fn() };
      
      conditionalAction(5, gadget);
      expect(mockAction).not.toHaveBeenCalled();
      
      conditionalAction(15, gadget);
      expect(mockAction).toHaveBeenCalledWith(15, gadget);
    });

    it('batch action should buffer and act on batches', () => {
      const mockBatchAction = vi.fn<[number[], any], void>();
      const batchAction = actions.batch(3, mockBatchAction);
      const gadget: Gadget<number> = { receive: vi.fn() };
      
      batchAction(1, gadget);
      batchAction(2, gadget);
      expect(mockBatchAction).not.toHaveBeenCalled();
      
      batchAction(3, gadget);
      expect(mockBatchAction).toHaveBeenCalledWith([1, 2, 3], gadget);
      
      batchAction(4, gadget);
      batchAction(5, gadget);
      batchAction(6, gadget);
      expect(mockBatchAction).toHaveBeenCalledWith([4, 5, 6], gadget);
      expect(mockBatchAction).toHaveBeenCalledTimes(2);
    });
  });

  describe('integration', () => {
    it('should allow chaining gadgets with direct actions', () => {
      const results: number[] = [];
      
      // First gadget doubles
      const doubler: Gadget<number> = {
        receive: function(data: number) {
          const double = fn(
            (x: number) => x * 2,
            actions.direct(adder)
          );
          double.call(this, data);
        }
      };
      
      // Second gadget adds 10
      const adder: Gadget<number> = {
        receive: function(data: number) {
          const add = fn(
            (x: number) => x + 10,
            (value) => results.push(value)
          );
          add.call(this, data);
        }
      };
      
      doubler.receive(5);  // 5 * 2 = 10, 10 + 10 = 20
      expect(results).toEqual([20]);
      
      doubler.receive(7);  // 7 * 2 = 14, 14 + 10 = 24
      expect(results).toEqual([20, 24]);
    });
  });
});