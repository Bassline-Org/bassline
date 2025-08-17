// Jest setup file for global test configuration

// Set longer timeout for property tests
jest.setTimeout(30000);

// Global test utilities
(global as any).testUtils = {
  // Helper to create test IDs
  createTestId: (prefix: string, num: number) => `${prefix}-test-${num}`,
  
  // Helper to wait for async operations
  waitFor: (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),
  
  // Helper to create mock functions with types
  createMockFn: <T extends (...args: any[]) => any>(): jest.MockedFunction<T> => {
    return jest.fn() as unknown as jest.MockedFunction<T>;
  }
};

// Suppress console output in tests unless DEBUG is set
if (!process.env.DEBUG) {
  global.console = {
    ...console,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
}

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
  jest.restoreAllMocks();
});

// Type declarations for global test utilities
declare global {
  namespace NodeJS {
    interface Global {
      testUtils: {
        createTestId: (prefix: string, num: number) => string;
        waitFor: (ms: number) => Promise<void>;
        createMockFn: <T extends (...args: any[]) => any>() => jest.MockedFunction<T>;
      };
    }
  }
}

export {};