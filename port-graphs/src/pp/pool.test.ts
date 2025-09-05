/**
 * Tests for Pool gadget
 */

import { describe, it, expect, vi } from 'vitest';
import { Gadget } from "./core";
import { createPool, assert, poolActions, Assertion, Match } from "./pool";

describe('Pool Gadget', () => {
  describe('basic matching', () => {
    it('should match provider and consumer', () => {
      const mockAction = vi.fn<[Match, any], void>();
      const pool = createPool(mockAction);

      const poolGadget: Gadget<Assertion> = {
        receive: function(data: Assertion) {
          pool.call(this, data);
        }
      };

      // First assertion: provider
      poolGadget.receive(assert.provides('sensor1', 'temperature'));
      expect(mockAction).not.toHaveBeenCalled(); // No match yet

      // Second assertion: consumer - should trigger match
      poolGadget.receive(assert.needs('display1', 'temperature'));
      expect(mockAction).toHaveBeenCalledTimes(1);
      expect(mockAction).toHaveBeenCalledWith(
        expect.objectContaining({
          tag: 'temperature',
          provider: expect.objectContaining({ id: 'sensor1' }),
          consumer: expect.objectContaining({ id: 'display1' })
        }),
        poolGadget
      );
    });

    it('should match consumer first, then provider', () => {
      const mockAction = vi.fn<[Match, any], void>();
      const pool = createPool(mockAction);

      const poolGadget: Gadget<Assertion> = {
        receive: function(data: Assertion) {
          pool.call(this, data);
        }
      };

      // Consumer first
      poolGadget.receive(assert.needs('display1', 'temperature'));
      expect(mockAction).not.toHaveBeenCalled();

      // Then provider - should trigger match
      poolGadget.receive(assert.provides('sensor1', 'temperature'));
      expect(mockAction).toHaveBeenCalledTimes(1);
    });

    it('should handle multiple consumers for one provider', () => {
      const mockAction = vi.fn<[Match, any], void>();
      const pool = createPool(mockAction);

      const poolGadget: Gadget<Assertion> = {
        receive: function(data: Assertion) {
          pool.call(this, data);
        }
      };

      // One provider
      poolGadget.receive(assert.provides('sensor1', 'temperature'));

      // Multiple consumers
      poolGadget.receive(assert.needs('display1', 'temperature'));
      poolGadget.receive(assert.needs('display2', 'temperature'));
      poolGadget.receive(assert.needs('logger1', 'temperature'));

      expect(mockAction).toHaveBeenCalledTimes(3);
      
      // Check all three matches were created
      const calls = mockAction.mock.calls;
      const consumerIds = calls.map(call => call[0].consumer.id).sort();
      expect(consumerIds).toEqual(['display1', 'display2', 'logger1']);
    });

    it('should handle multiple providers for one consumer', () => {
      const mockAction = vi.fn<[Match, any], void>();
      const pool = createPool(mockAction);

      const poolGadget: Gadget<Assertion> = {
        receive: function(data: Assertion) {
          pool.call(this, data);
        }
      };

      // One consumer
      poolGadget.receive(assert.needs('aggregator1', 'temperature'));

      // Multiple providers
      poolGadget.receive(assert.provides('sensor1', 'temperature'));
      poolGadget.receive(assert.provides('sensor2', 'temperature'));
      poolGadget.receive(assert.provides('sensor3', 'temperature'));

      expect(mockAction).toHaveBeenCalledTimes(3);
      
      // Check all three matches were created
      const calls = mockAction.mock.calls;
      const providerIds = calls.map(call => call[0].provider.id).sort();
      expect(providerIds).toEqual(['sensor1', 'sensor2', 'sensor3']);
    });

    it('should not create duplicate connections', () => {
      const mockAction = vi.fn<[Match, any], void>();
      const pool = createPool(mockAction);

      const poolGadget: Gadget<Assertion> = {
        receive: function(data: Assertion) {
          pool.call(this, data);
        }
      };

      // Create a match
      poolGadget.receive(assert.provides('sensor1', 'temperature'));
      poolGadget.receive(assert.needs('display1', 'temperature'));
      expect(mockAction).toHaveBeenCalledTimes(1);

      // Try to create the same match again
      poolGadget.receive(assert.provides('sensor1', 'temperature'));
      poolGadget.receive(assert.needs('display1', 'temperature'));
      
      // Should still only have been called once
      expect(mockAction).toHaveBeenCalledTimes(1);
    });

    it('should handle different tags independently', () => {
      const mockAction = vi.fn<[Match, any], void>();
      const pool = createPool(mockAction);

      const poolGadget: Gadget<Assertion> = {
        receive: function(data: Assertion) {
          pool.call(this, data);
        }
      };

      // Temperature provider and consumer
      poolGadget.receive(assert.provides('sensor1', 'temperature'));
      poolGadget.receive(assert.needs('display1', 'temperature'));

      // Humidity provider and consumer  
      poolGadget.receive(assert.provides('sensor2', 'humidity'));
      poolGadget.receive(assert.needs('display2', 'humidity'));

      expect(mockAction).toHaveBeenCalledTimes(2);
      
      const calls = mockAction.mock.calls;
      const tags = calls.map(call => call[0].tag).sort();
      expect(tags).toEqual(['humidity', 'temperature']);
    });
  });

  describe('with actual gadgets', () => {
    it('should wire gadgets together', () => {
      const results: any[] = [];
      
      // Create actual gadgets
      const provider: Gadget<number> = {
        receive: vi.fn((data: number) => {
          // Provider logic here
        })
      };

      const consumer: Gadget<number> = {
        receive: vi.fn((data: number) => {
          results.push(data);
        })
      };

      // Create pool with direct wiring
      const pool = createPool<Gadget<Assertion>>((match) => {
        if (match.provider.gadget && match.consumer.gadget) {
          // Simple direct forwarding for test
          const originalReceive = match.provider.gadget.receive;
          match.provider.gadget.receive = function(data: any) {
            originalReceive.call(this, data);
            match.consumer.gadget?.receive(data);
          };
        }
      });

      const poolGadget: Gadget<Assertion> = {
        receive: function(data: Assertion) {
          pool.call(this, data);
        }
      };

      // Register gadgets with pool
      poolGadget.receive(assert.provides('provider', 'data', provider));
      poolGadget.receive(assert.needs('consumer', 'data', consumer));

      // Now when provider receives data, it should forward to consumer
      provider.receive(42);
      
      expect(consumer.receive).toHaveBeenCalledWith(42);
      expect(results).toEqual([42]);
    });
  });

  describe('pool actions', () => {
    it('logMatch should log matches', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const logAction = poolActions.logMatch();
      
      const match: Match = {
        tag: 'temperature',
        provider: { id: 'sensor1' },
        consumer: { id: 'display1' }
      };
      
      logAction(match, {} as Gadget);
      
      expect(consoleSpy).toHaveBeenCalledWith(
        'Pool: Matched sensor1 -> display1 for "temperature"'
      );
      
      consoleSpy.mockRestore();
    });
  });
});