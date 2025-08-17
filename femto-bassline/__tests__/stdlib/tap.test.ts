/**
 * Tests for the Tap shim gadget
 */

import { 
  TapGadget,
  createTapGadget,
  createTapGadgetSpec,
  getTapPinout
} from '../../stdlib/shims/tap';
import { createPulseId } from '../../core/types';

describe('Tap Gadget', () => {
  let consoleLogSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  describe('Basic functionality', () => {
    it('should pass through values unchanged', () => {
      const tap = createTapGadget('test-tap');
      
      const input = { value: 42 };
      const output = tap.process(input);
      
      expect(output).toBe(input);
      expect(output).toEqual(input);
    });

    it('should preserve pulse identity', () => {
      const tap = createTapGadget('test-tap');
      
      const pulse = {
        reqId: createPulseId('test-pulse'),
        payload: { data: 'test' }
      };
      
      const output = tap.process(pulse);
      expect(output).toBe(pulse);
    });
  });

  describe('Console target', () => {
    it('should log to console', () => {
      const tap = createTapGadget('console-tap', {
        target: 'console',
        format: { label: 'TEST' }
      });

      tap.process(42);
      
      expect(consoleLogSpy).toHaveBeenCalled();
      const logCall = consoleLogSpy.mock.calls[0];
      expect(logCall[0]).toBe('[TAP]');
      expect(logCall[1]).toMatchObject({
        label: 'TEST',
        value: 42
      });
    });

    it('should include timestamp when configured', () => {
      const tap = createTapGadget('timestamp-tap', {
        target: 'console',
        format: { includeTimestamp: true }
      });

      tap.process('test');
      
      const logCall = consoleLogSpy.mock.calls[0];
      expect(logCall[1]).toHaveProperty('time');
      expect(logCall[1].time).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('should include pulse ID when available', () => {
      const tap = createTapGadget('pulse-tap', {
        target: 'console',
        format: { includePulseId: true }
      });

      const pulseId = createPulseId('test');
      tap.process({
        reqId: pulseId,
        payload: 'data'
      });
      
      const logCall = consoleLogSpy.mock.calls[0];
      expect(logCall[1]).toHaveProperty('pulse', pulseId);
    });
  });

  describe('Memory target', () => {
    it('should store observations in memory', () => {
      const tap = createTapGadget('memory-tap', {
        target: 'memory'
      });

      tap.process(1);
      tap.process(2);
      tap.process(3);
      
      const observations = tap.getObservations();
      expect(observations).toHaveLength(3);
      expect(observations.map(o => o.value)).toEqual([1, 2, 3]);
    });

    it('should clear observations', () => {
      const tap = createTapGadget('memory-tap', {
        target: 'memory'
      });

      tap.process('a');
      tap.process('b');
      
      expect(tap.getObservations()).toHaveLength(2);
      
      tap.clearObservations();
      expect(tap.getObservations()).toHaveLength(0);
    });
  });

  describe('Callback target', () => {
    it('should invoke callback with observations', () => {
      const callback = jest.fn();
      
      const tap = createTapGadget('callback-tap', {
        target: 'callback',
        callback
      });

      tap.process(42);
      
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          value: 42,
          timestamp: expect.any(Number)
        })
      );
    });

    it('should handle callback errors gracefully', () => {
      const errorSpy = jest.spyOn(console, 'error').mockImplementation();
      const callback = jest.fn(() => {
        throw new Error('Callback error');
      });
      
      const tap = createTapGadget('error-tap', {
        target: 'callback',
        callback
      });

      // Should not throw
      expect(() => tap.process('test')).not.toThrow();
      
      expect(errorSpy).toHaveBeenCalledWith(
        '[TAP] Callback error:',
        expect.any(Error)
      );
      
      errorSpy.mockRestore();
    });
  });

  describe('Filtering', () => {
    it('should respect minimum interval', async () => {
      const tap = createTapGadget('interval-tap', {
        target: 'memory',
        filter: { minInterval: 100 }
      });

      tap.process(1);
      tap.process(2); // Should be filtered
      
      await testUtils.waitFor(150);
      
      tap.process(3); // Should pass
      
      const observations = tap.getObservations();
      expect(observations.map(o => o.value)).toEqual([1, 3]);
    });

    it('should respect max count', () => {
      const tap = createTapGadget('count-tap', {
        target: 'memory',
        filter: { maxCount: 2 }
      });

      tap.process(1);
      tap.process(2);
      tap.process(3); // Should be filtered
      tap.process(4); // Should be filtered
      
      const observations = tap.getObservations();
      expect(observations).toHaveLength(2);
      expect(observations.map(o => o.value)).toEqual([1, 2]);
    });

    it('should apply predicate filter', () => {
      const tap = createTapGadget('predicate-tap', {
        target: 'memory',
        filter: {
          predicate: (value: any) => value > 5
        }
      });

      tap.process(3);
      tap.process(7);
      tap.process(2);
      tap.process(10);
      
      const observations = tap.getObservations();
      expect(observations.map(o => o.value)).toEqual([7, 10]);
    });
  });

  describe('Statistics', () => {
    it('should track tap statistics', () => {
      const tap = createTapGadget('stats-tap', {
        target: 'memory'
      });

      tap.process('a');
      tap.process('b');
      tap.process('c');
      
      const stats = tap.getStats();
      expect(stats.count).toBe(3);
      expect(stats.memorySize).toBe(3);
      expect(stats.lastTap).toBeGreaterThan(0);
    });
  });

  describe('Gadget specification', () => {
    it('should create valid gadget spec', () => {
      const spec = createTapGadgetSpec({
        target: 'console',
        format: { label: 'test' }
      });

      expect(spec.params.type).toBe('tap');
      expect(spec.params.config).toMatchObject({
        target: 'console',
        format: { label: 'test' }
      });
      expect(spec.traits).toContainEqual(
        expect.objectContaining({ trait: 'pure' })
      );
      expect(spec.traits).toContainEqual(
        expect.objectContaining({ trait: 'deterministic' })
      );
    });

    it('should define correct pinout', () => {
      const pinout = getTapPinout();
      
      expect(pinout.pins).toHaveProperty('in');
      expect(pinout.pins).toHaveProperty('out');
      expect(pinout.pins).toHaveProperty('monitor');
      
      expect(pinout.pins.in.kind).toBe('ValueIn');
      expect(pinout.pins.in.required).toBe(true);
      
      expect(pinout.pins.out.kind).toBe('ValueOut');
      expect(pinout.pins.out.required).toBe(true);
      
      expect(pinout.pins.monitor.kind).toBe('EventOut');
      expect(pinout.pins.monitor.required).toBe(false);
    });
  });
});