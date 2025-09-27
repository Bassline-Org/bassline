import { describe, it, expect, vi } from 'vitest';
import { factoryBassline } from './factoryBassline';
import { localStorageGadget } from '../patterns/io/localStorage';
import { maxCell, minCell, lastCell } from '../patterns/cells';
import { withTaps, extract } from '../core/typed';

// Mock localStorage
const localStorageMock = {
  store: {} as Record<string, string>,
  getItem: vi.fn((key: string) => localStorageMock.store[key] || null),
  setItem: vi.fn((key: string, value: string) => {
    localStorageMock.store[key] = value;
  }),
  removeItem: vi.fn((key: string) => {
    delete localStorageMock.store[key];
  }),
  clear: vi.fn(() => {
    localStorageMock.store = {};
  })
};

Object.defineProperty(global, 'localStorage', {
  value: localStorageMock,
  writable: true
});

describe('Bassline Integration', () => {
  it('should create a functional network with persistence', () => {
    // Create a bassline with some gadget types
    const bassline = withTaps(factoryBassline({
      max: maxCell,
      min: minCell,
      last: lastCell
    }));

    // Create storage gadget
    const storage = localStorageGadget('test-network');

    // Track bassline changes
    const changes: any[] = [];
    bassline.tap(effect => changes.push(effect));

    // Create instances
    bassline.receive({ spawn: { name: 'sensor', type: 'max', args: [0] } });
    bassline.receive({ spawn: { name: 'processor', type: 'min', args: [100] } });
    bassline.receive({ spawn: { name: 'output', type: 'last', args: [null] } });

    // Verify instances were created
    expect(changes.some(c => c.spawned?.name === 'sensor')).toBe(true);
    expect(changes.some(c => c.spawned?.name === 'processor')).toBe(true);
    expect(changes.some(c => c.spawned?.name === 'output')).toBe(true);

    // Create connections
    bassline.receive({
      connect: {
        id: 'sensor-processor',
        from: 'sensor',
        to: 'processor',
        pattern: 'extract'
      }
    });

    bassline.receive({
      connect: {
        id: 'processor-output',
        from: 'processor',
        to: 'output',
        pattern: 'extract'
      }
    });

    // Test data flow
    const state = bassline.current();
    const sensor = state.instances['sensor'];
    const processor = state.instances['processor'];
    const output = state.instances['output'];

    // Send data through the network
    sensor?.receive(50);
    expect(sensor?.current()).toBe(50);
    expect(processor?.current()).toBe(50); // min(100, 50) = 50
    expect(output?.current()).toBe(50);

    // Save network state
    const snapshot = {
      instances: Object.entries(state.instances).map(([name, g]) => ({
        name,
        state: g.current()
      })),
      connections: Object.entries(state.connections).map(([id, c]) => ({
        id,
        ...c.data
      }))
    };

    storage.receive({ save: snapshot });

    // Verify saved to localStorage
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'test-network',
      expect.stringContaining('sensor')
    );

    // Clear and restore
    bassline.receive({ destroy: 'sensor' });
    bassline.receive({ destroy: 'processor' });
    bassline.receive({ destroy: 'output' });

    // Load from storage
    storage.receive({ load: {} });
    const loaded = storage.current().data;

    expect(loaded).toBeDefined();
    expect(loaded.instances).toHaveLength(3);
    expect(loaded.connections).toHaveLength(2);
  });

  it('should handle error recovery with multiple basslines', () => {
    // Main bassline with no types initially
    const main = withTaps(factoryBassline());

    // Type provider bassline with types
    const provider = withTaps(factoryBassline({
      max: maxCell,
      min: minCell
    }));

    // Wire error recovery
    main.tap(({ unknownType }) => {
      if (unknownType) {
        const providerTypes = provider.current().types;
        const factory = providerTypes[unknownType.type];
        if (factory) {
          main.receive({
            defineType: {
              name: unknownType.type,
              factory
            }
          });
        }
      }
    });

    // Try to spawn unknown type
    main.receive({ spawn: { name: 'test', type: 'max', args: [0] } });

    // Should fail first, then succeed after type is provided
    const mainState = main.current();
    expect(mainState.types['max']).toBeDefined();

    // Try again - should work now
    main.receive({ spawn: { name: 'test', type: 'max', args: [0] } });
    expect(mainState.instances['test']).toBeDefined();
  });

  it('should support custom patterns', () => {
    const bassline = withTaps(factoryBassline({
      max: maxCell
    }));

    // Define a custom pattern that doubles values
    bassline.receive({
      definePattern: {
        name: 'double',
        pattern: (from: any, to: any) => {
          const cleanup = from.tap((e: any) => {
            if ('changed' in e && e.changed !== undefined) {
              to.receive(e.changed * 2);
            }
          });
          return { cleanup };
        }
      }
    });

    // Create instances
    bassline.receive({ spawn: { name: 'a', type: 'max', args: [0] } });
    bassline.receive({ spawn: { name: 'b', type: 'max', args: [0] } });

    // Connect with custom pattern
    bassline.receive({
      connect: {
        id: 'double-link',
        from: 'a',
        to: 'b',
        pattern: 'double'
      }
    });

    // Test doubling
    const state = bassline.current();
    const a = state.instances['a'];
    const b = state.instances['b'];

    a?.receive(5);
    expect(a?.current()).toBe(5);
    expect(b?.current()).toBe(10); // Doubled!
  });

  it('should clean up connections when instances are destroyed', () => {
    const bassline = withTaps(factoryBassline({
      max: maxCell
    }));

    // Create instances
    bassline.receive({ spawn: { name: 'a', type: 'max', args: [0] } });
    bassline.receive({ spawn: { name: 'b', type: 'max', args: [0] } });
    bassline.receive({ spawn: { name: 'c', type: 'max', args: [0] } });

    // Create connections
    bassline.receive({ connect: { id: 'ab', from: 'a', to: 'b' } });
    bassline.receive({ connect: { id: 'bc', from: 'b', to: 'c' } });

    expect(Object.keys(bassline.current().connections)).toHaveLength(2);

    // Destroy middle node
    bassline.receive({ destroy: 'b' });

    // Both connections should be removed
    expect(Object.keys(bassline.current().connections)).toHaveLength(0);
    expect(bassline.current().instances['b']).toBeUndefined();

    // Other instances should still exist
    expect(bassline.current().instances['a']).toBeDefined();
    expect(bassline.current().instances['c']).toBeDefined();
  });
});