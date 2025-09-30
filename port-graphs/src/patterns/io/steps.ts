/**
 * IO Pattern Steps - Pure logic for IO operations
 */

// ============================================
// LocalStorage Step
// ============================================

export type LocalStorageState = {
  key: string;
  data: unknown;
  lastSaved?: number;
  lastLoaded?: number;
};

export type LocalStorageInput =
  | { save: unknown }
  | { load: {} }
  | { clear: {} }
  | { setKey: string };

export type LocalStorageEffects =
  | { saved: { key: string; data: unknown; timestamp: number }; merge: LocalStorageState }
  | { loaded: { key: string; data: unknown; timestamp: number }; merge: LocalStorageState }
  | { cleared: { key: string }; merge: LocalStorageState }
  | { error: { operation: string; error: string } }
  | { keyChanged: { oldKey: string; newKey: string }; merge: LocalStorageState };

export const localStorageStep = (
  state: LocalStorageState,
  input: LocalStorageInput
): LocalStorageEffects | undefined => {
  if ('save' in input) {
    const timestamp = Date.now();
    try {
      const serialized = JSON.stringify(input.save);
      localStorage.setItem(state.key, serialized);

      return {
        saved: { key: state.key, data: input.save, timestamp },
        merge: { ...state, data: input.save, lastSaved: timestamp }
      };
    } catch (error) {
      return {
        error: {
          operation: 'save',
          error: String(error)
        }
      };
    }
  }

  if ('load' in input) {
    const timestamp = Date.now();
    try {
      const stored = localStorage.getItem(state.key);
      if (stored === null) {
        return {
          loaded: { key: state.key, data: null, timestamp },
          merge: state
        };
      }

      const data = JSON.parse(stored);
      return {
        loaded: { key: state.key, data, timestamp },
        merge: { ...state, data, lastLoaded: timestamp }
      };
    } catch (error) {
      return {
        error: {
          operation: 'load',
          error: String(error)
        }
      };
    }
  }

  if ('clear' in input) {
    try {
      localStorage.removeItem(state.key);
      const newState: LocalStorageState = {
        key: state.key,
        data: undefined
      };
      return {
        cleared: { key: state.key },
        merge: newState
      };
    } catch (error) {
      return {
        error: {
          operation: 'clear',
          error: String(error)
        }
      };
    }
  }

  if ('setKey' in input) {
    return {
      keyChanged: { oldKey: state.key, newKey: input.setKey },
      merge: { ...state, key: input.setKey }
    };
  }

  return undefined;
};

// ============================================
// FileIO Step
// ============================================

export type FileIOState = {
  lastFileName?: string;
  lastData?: unknown;
  mimeType: string;
};

export type FileIOInput =
  | { download: { data: unknown; filename: string } }
  | { read: File }
  | { setMimeType: string };

export type FileIOEffects =
  | { downloaded: { filename: string; size: number }; merge: FileIOState }
  | { fileRead: { filename: string; data: unknown; size: number }; merge: FileIOState }
  | { error: { operation: string; error: string } }
  | { mimeTypeChanged: string; merge: FileIOState };

export const fileIOStep = (
  state: FileIOState,
  input: FileIOInput
): FileIOEffects | undefined => {
  if ('download' in input) {
    const { data, filename } = input.download;
    try {
      // Serialize data based on mime type
      let content: string;
      if (state.mimeType === 'application/json') {
        content = JSON.stringify(data, null, 2);
      } else {
        content = String(data);
      }

      // Create blob and download link
      const blob = new Blob([content], { type: state.mimeType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();

      // Clean up
      URL.revokeObjectURL(url);

      return {
        downloaded: { filename, size: blob.size },
        merge: { ...state, lastFileName: filename, lastData: data }
      };
    } catch (error) {
      return {
        error: {
          operation: 'download',
          error: String(error)
        }
      };
    }
  }

  if ('read' in input) {
    const file = input.read;
    // Note: FileReader is async, so we can't return the result directly
    // This will be handled in the handler
    return undefined;
  }

  if ('setMimeType' in input) {
    return {
      mimeTypeChanged: input.setMimeType,
      merge: { ...state, mimeType: input.setMimeType }
    };
  }

  return undefined;
};

// ============================================
// FileInput Step
// ============================================

export type FileInputState = {
  accept?: string;
  multiple: boolean;
  lastFiles?: FileList;
};

export type FileInputInput =
  | { filesSelected: FileList }
  | { clear: {} }
  | { setAccept: string }
  | { setMultiple: boolean };

export type FileInputEffects =
  | { selected: File[]; merge: FileInputState }
  | { cleared: {}; merge: FileInputState }
  | { acceptChanged: string; merge: FileInputState }
  | { multipleChanged: boolean; merge: FileInputState };

export const fileInputStep = (
  state: FileInputState,
  input: FileInputInput
): FileInputEffects | undefined => {
  if ('filesSelected' in input) {
    return {
      selected: Array.from(input.filesSelected),
      merge: { ...state, lastFiles: input.filesSelected }
    };
  }

  if ('clear' in input) {
    const newState: FileInputState = {
      accept: state.accept,
      multiple: state.multiple
    };
    return {
      cleared: {},
      merge: newState
    };
  }

  if ('setAccept' in input) {
    return {
      acceptChanged: input.setAccept,
      merge: { ...state, accept: input.setAccept }
    };
  }

  if ('setMultiple' in input) {
    return {
      multipleChanged: input.setMultiple,
      merge: { ...state, multiple: input.setMultiple }
    };
  }

  return undefined;
};
