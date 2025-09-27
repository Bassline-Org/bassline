import { describe, it, expect, beforeEach, vi } from 'vitest';
import { localStorageGadget } from './localStorage';
import { withTaps } from '../../core/typed';

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

// Replace global localStorage
Object.defineProperty(global, 'localStorage', {
  value: localStorageMock,
  writable: true
});

describe('localStorageGadget', () => {
  beforeEach(() => {
    // Clear mock store before each test
    localStorageMock.store = {};
    vi.clearAllMocks();
  });

  describe('save operation', () => {
    it('should save data to localStorage', () => {
      const storage = withTaps(localStorageGadget('test-key'));
      let emitted: any;

      storage.tap(e => emitted = e);
      storage.receive({ save: { foo: 'bar', count: 42 } });

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'test-key',
        JSON.stringify({ foo: 'bar', count: 42 })
      );
      expect(emitted.saved).toBeDefined();
      expect(emitted.saved.key).toBe('test-key');
      expect(emitted.saved.data).toEqual({ foo: 'bar', count: 42 });
    });

    it('should update internal state when saving', () => {
      const storage = localStorageGadget('test-key');
      const testData = { test: 'data' };

      storage.receive({ save: testData });

      expect(storage.current().data).toEqual(testData);
      expect(storage.current().lastSaved).toBeDefined();
    });

    it('should emit error on save failure', () => {
      const storage = withTaps(localStorageGadget('test-key'));
      let emitted: any;

      // Make JSON.stringify throw
      const circularRef: any = {};
      circularRef.self = circularRef;

      storage.tap(e => emitted = e);
      storage.receive({ save: circularRef });

      expect(emitted.error).toBeDefined();
      expect(emitted.error.operation).toBe('save');
    });
  });

  describe('load operation', () => {
    it('should load data from localStorage', () => {
      const storage = withTaps(localStorageGadget('test-key'));
      let emitted: any;

      // Pre-populate localStorage
      localStorageMock.store['test-key'] = JSON.stringify({ loaded: 'data' });

      storage.tap(e => emitted = e);
      storage.receive({ load: {} });

      expect(localStorageMock.getItem).toHaveBeenCalledWith('test-key');
      expect(emitted.loaded).toBeDefined();
      expect(emitted.loaded.data).toEqual({ loaded: 'data' });
    });

    it('should emit null when key not found', () => {
      const storage = withTaps(localStorageGadget('missing-key'));
      let emitted: any;

      storage.tap(e => emitted = e);
      storage.receive({ load: {} });

      expect(emitted.loaded).toBeDefined();
      expect(emitted.loaded.data).toBeNull();
    });

    it('should emit error on parse failure', () => {
      const storage = withTaps(localStorageGadget('test-key'));
      let emitted: any;

      // Store invalid JSON
      localStorageMock.store['test-key'] = 'not valid json {';

      storage.tap(e => emitted = e);
      storage.receive({ load: {} });

      expect(emitted.error).toBeDefined();
      expect(emitted.error.operation).toBe('load');
    });
  });

  describe('clear operation', () => {
    it('should remove item from localStorage', () => {
      const storage = withTaps(localStorageGadget('test-key'));
      let emitted: any;

      // Save something first
      storage.receive({ save: { test: 'data' } });

      storage.tap(e => emitted = e);
      storage.receive({ clear: {} });

      expect(localStorageMock.removeItem).toHaveBeenCalledWith('test-key');
      expect(emitted.cleared).toBeDefined();
      expect(emitted.cleared.key).toBe('test-key');
    });

    it('should clear internal state', () => {
      const storage = localStorageGadget('test-key');

      // Save something first
      storage.receive({ save: { test: 'data' } });
      expect(storage.current().data).toBeDefined();

      // Clear
      storage.receive({ clear: {} });
      expect(storage.current().data).toBeUndefined();
      expect(storage.current().lastSaved).toBeUndefined();
    });
  });

  describe('key management', () => {
    it('should change storage key', () => {
      const storage = withTaps(localStorageGadget('old-key'));
      let emitted: any;

      storage.tap(e => emitted = e);
      storage.receive({ setKey: 'new-key' });

      expect(emitted.keyChanged).toBeDefined();
      expect(emitted.keyChanged.oldKey).toBe('old-key');
      expect(emitted.keyChanged.newKey).toBe('new-key');
      expect(storage.current().key).toBe('new-key');
    });

    it('should save to new key after change', () => {
      const storage = localStorageGadget('old-key');

      storage.receive({ setKey: 'new-key' });
      storage.receive({ save: { test: 'data' } });

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'new-key',
        JSON.stringify({ test: 'data' })
      );
    });
  });

  describe('integration', () => {
    it('should handle save, load, clear cycle', () => {
      const storage = withTaps(localStorageGadget('cycle-test'));
      const effects: any[] = [];

      storage.tap(e => effects.push(e));

      // Save
      storage.receive({ save: { value: 1 } });
      expect(effects[0].saved).toBeDefined();

      // Load
      storage.receive({ load: {} });
      expect(effects[1].loaded.data).toEqual({ value: 1 });

      // Clear
      storage.receive({ clear: {} });
      expect(effects[2].cleared).toBeDefined();

      // Load again - should be null
      storage.receive({ load: {} });
      expect(effects[3].loaded.data).toBeNull();
    });
  });
});