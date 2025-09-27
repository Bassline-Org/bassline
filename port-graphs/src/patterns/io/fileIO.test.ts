import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fileIOGadget, fileInputGadget } from './fileIO';
import { withTaps } from '../../core/typed';

// Mock DOM APIs
const createObjectURLMock = vi.fn(() => 'blob:mock-url');
const revokeObjectURLMock = vi.fn();
const clickMock = vi.fn();

// Mock URL
global.URL = {
  createObjectURL: createObjectURLMock,
  revokeObjectURL: revokeObjectURLMock
} as any;

// Mock document.createElement
global.document = {
  createElement: vi.fn((tag: string) => {
    if (tag === 'a') {
      return {
        href: '',
        download: '',
        click: clickMock
      };
    }
    return {};
  })
} as any;

// Mock Blob
const MockBlob = vi.fn((content: any[], options?: { type?: string }) => {
  return {
    content,
    size: content[0]?.length || 0,
    type: options?.type || 'text/plain'
  };
});
global.Blob = MockBlob as any;

// Mock File
global.File = class MockFile {
  name: string;
  size: number;
  type: string;

  constructor(content: any[], name: string, options?: { type?: string }) {
    this.name = name;
    this.size = content[0]?.length || 0;
    this.type = options?.type || 'text/plain';
  }
} as any;

// Mock FileReader
class MockFileReader {
  onload: ((event: any) => void) | null = null;
  onerror: (() => void) | null = null;
  result: string | null = null;

  readAsText(file: any) {
    // Simulate async read
    setTimeout(() => {
      if (this.onload) {
        // Simulate successful read
        this.result = file._mockContent || '{"test": "data"}';
        this.onload({ target: { result: this.result } });
      }
    }, 0);
  }
}

global.FileReader = MockFileReader as any;

describe('fileIOGadget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('download operation', () => {
    it('should download JSON data', () => {
      const fileIO = withTaps(fileIOGadget());
      let emitted: any;

      fileIO.tap(e => emitted = e);
      fileIO.receive({
        download: {
          data: { test: 'value', count: 42 },
          filename: 'test.json'
        }
      });

      // Check that blob was created with correct content
      expect(MockBlob).toHaveBeenCalledWith(
        [JSON.stringify({ test: 'value', count: 42 }, null, 2)],
        { type: 'application/json' }
      );

      // Check URL was created and revoked
      expect(createObjectURLMock).toHaveBeenCalled();
      expect(revokeObjectURLMock).toHaveBeenCalled();

      // Check download was triggered
      expect(clickMock).toHaveBeenCalled();

      // Check effect was emitted
      expect(emitted.downloaded).toBeDefined();
      expect(emitted.downloaded.filename).toBe('test.json');
    });

    it('should download text data with custom mime type', () => {
      const fileIO = fileIOGadget('text/plain');

      fileIO.receive({ setMimeType: 'text/plain' });
      fileIO.receive({
        download: {
          data: 'Hello, World!',
          filename: 'greeting.txt'
        }
      });

      expect(MockBlob).toHaveBeenCalledWith(
        ['Hello, World!'],
        { type: 'text/plain' }
      );
    });

    it('should update internal state after download', () => {
      const fileIO = fileIOGadget();

      fileIO.receive({
        download: {
          data: { saved: 'data' },
          filename: 'saved.json'
        }
      });

      expect(fileIO.current().lastFileName).toBe('saved.json');
      expect(fileIO.current().lastData).toEqual({ saved: 'data' });
    });

    it('should emit error on download failure', () => {
      const fileIO = withTaps(fileIOGadget());
      let emitted: any;

      // Make Blob constructor throw
      global.Blob = vi.fn(() => {
        throw new Error('Blob creation failed');
      }) as any;

      fileIO.tap(e => emitted = e);
      fileIO.receive({
        download: {
          data: { test: 'data' },
          filename: 'fail.json'
        }
      });

      expect(emitted.error).toBeDefined();
      expect(emitted.error.operation).toBe('download');
    });
  });

  describe('read operation', () => {
    it('should read JSON file', async () => {
      const fileIO = withTaps(fileIOGadget());
      const effects: any[] = [];

      fileIO.tap(e => effects.push(e));

      const mockFile = new File(['{"loaded": "data"}'], 'data.json', { type: 'application/json' });
      (mockFile as any)._mockContent = '{"loaded": "data"}';

      fileIO.receive({ read: mockFile as any });

      // Wait for async FileReader
      await new Promise(resolve => setTimeout(resolve, 10));

      // Should emit fileRead effect
      const fileReadEffect = effects.find(e => e.fileRead);
      expect(fileReadEffect).toBeDefined();
      expect(fileReadEffect.fileRead.filename).toBe('data.json');
      expect(fileReadEffect.fileRead.data).toEqual({ loaded: 'data' });
    });

    it('should read text file', async () => {
      const fileIO = withTaps(fileIOGadget());
      const effects: any[] = [];

      fileIO.tap(e => effects.push(e));

      const mockFile = new File(['Plain text content'], 'readme.txt', { type: 'text/plain' });
      (mockFile as any)._mockContent = 'Plain text content';

      fileIO.receive({ read: mockFile as any });

      await new Promise(resolve => setTimeout(resolve, 10));

      const fileReadEffect = effects.find(e => e.fileRead);
      expect(fileReadEffect.fileRead.data).toBe('Plain text content');
    });

    it('should emit error on invalid JSON', async () => {
      const fileIO = withTaps(fileIOGadget());
      const effects: any[] = [];

      fileIO.tap(e => effects.push(e));

      const mockFile = new File(['not valid json'], 'bad.json', { type: 'application/json' });
      (mockFile as any)._mockContent = 'not valid json';

      fileIO.receive({ read: mockFile as any });

      await new Promise(resolve => setTimeout(resolve, 10));

      const errorEffect = effects.find(e => e.error);
      expect(errorEffect).toBeDefined();
      expect(errorEffect.error.operation).toBe('read');
    });
  });

  describe('mime type management', () => {
    it('should change mime type', () => {
      const fileIO = withTaps(fileIOGadget());
      let emitted: any;

      fileIO.tap(e => emitted = e);
      fileIO.receive({ setMimeType: 'text/csv' });

      expect(emitted.mimeTypeChanged).toBe('text/csv');
      expect(fileIO.current().mimeType).toBe('text/csv');
    });
  });
});

describe('fileInputGadget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should emit selected files', () => {
    const input = withTaps(fileInputGadget('.json', false));
    let emitted: any;

    input.tap(e => emitted = e);

    // Mock FileList
    const mockFiles = [
      new File(['content1'], 'file1.json'),
      new File(['content2'], 'file2.json')
    ] as any;

    input.receive({ filesSelected: mockFiles });

    expect(emitted.selected).toBeDefined();
    expect(emitted.selected.length).toBe(2);
  });

  it('should clear selected files', () => {
    const input = fileInputGadget();

    // Select files first
    const mockFiles = [new File(['content'], 'file.txt')] as any;
    input.receive({ filesSelected: mockFiles });
    expect(input.current().lastFiles).toBeDefined();

    // Clear
    input.receive({ clear: {} });
    expect(input.current().lastFiles).toBeUndefined();
  });

  it('should update accept pattern', () => {
    const input = withTaps(fileInputGadget());
    let emitted: any;

    input.tap(e => emitted = e);
    input.receive({ setAccept: '.pdf,.doc' });

    expect(emitted.acceptChanged).toBe('.pdf,.doc');
    expect(input.current().accept).toBe('.pdf,.doc');
  });

  it('should toggle multiple file selection', () => {
    const input = withTaps(fileInputGadget(undefined, false));
    let emitted: any;

    input.tap(e => emitted = e);
    input.receive({ setMultiple: true });

    expect(emitted.multipleChanged).toBe(true);
    expect(input.current().multiple).toBe(true);
  });
});