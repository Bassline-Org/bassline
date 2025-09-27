/**
 * FileIO gadget - Handles file import/export operations
 *
 * A gadget that manages file reading and writing in the browser.
 * Can trigger downloads and read uploaded files.
 */

import { type State, type Input, type Actions, type Effects, defGadget, withTaps } from '../../core/typed';

export type FileIOSpec =
  & State<{
    lastFileName?: string;
    lastData?: any;
    mimeType: string;
  }>
  & Input<
    | { download: { data: any; filename: string } }
    | { read: File }
    | { setMimeType: string }
  >
  & Actions<{
    download: { data: any; filename: string };
    read: File;
    setMimeType: string;
  }>
  & Effects<{
    downloaded: { filename: string; size: number };
    fileRead: { filename: string; data: any; size: number };
    error: { operation: string; error: string };
    mimeTypeChanged: string;
  }>;

export function fileIOGadget(mimeType: string = 'application/json') {
  return withTaps(defGadget<FileIOSpec>({
    dispatch: (state, input) => {
      if ('download' in input) return { download: input.download };
      if ('read' in input) return { read: input.read };
      if ('setMimeType' in input) return { setMimeType: input.setMimeType };
      return null;
    },

    methods: {
      download: (gadget, { data, filename }) => {
        const state = gadget.current();

        try {
          // Serialize data based on mime type
          let content: string;
          if (state.mimeType === 'application/json') {
            content = JSON.stringify(data, null, 2);
          } else if (state.mimeType === 'text/plain') {
            content = String(data);
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

          gadget.update({
            ...state,
            lastFileName: filename,
            lastData: data
          });

          return {
            downloaded: {
              filename,
              size: blob.size
            }
          };
        } catch (error) {
          return {
            error: {
              operation: 'download',
              error: String(error)
            }
          };
        }
      },

      read: (gadget, file) => {
        const state = gadget.current();

        // Use FileReader API to read the file
        const reader = new FileReader();

        reader.onload = (event) => {
          try {
            const content = event.target?.result as string;
            let data: any;

            // Parse based on mime type
            if (file.type === 'application/json' || file.name.endsWith('.json')) {
              data = JSON.parse(content);
            } else {
              data = content;
            }

            gadget.update({
              ...state,
              lastFileName: file.name,
              lastData: data
            });

            gadget.emit({
              fileRead: {
                filename: file.name,
                data,
                size: file.size
              }
            });
          } catch (error) {
            gadget.emit({
              error: {
                operation: 'read',
                error: String(error)
              }
            });
          }
        };

        reader.onerror = () => {
          gadget.emit({
            error: {
              operation: 'read',
              error: 'Failed to read file'
            }
          });
        };

        // Start reading the file
        reader.readAsText(file);

        // Return empty object since the actual result comes via effect
        return {};
      },

      setMimeType: (gadget, mimeType) => {
        gadget.update({
          ...gadget.current(),
          mimeType
        });

        return { mimeTypeChanged: mimeType };
      }
    }
  })({
    mimeType
  }));
}

/**
 * Helper gadget for file input UI element
 * Emits selected files as effects
 */
export type FileInputSpec =
  & State<{
    accept?: string;
    multiple: boolean;
    lastFiles?: FileList;
  }>
  & Input<
    | { filesSelected: FileList }
    | { clear: {} }
    | { setAccept: string }
    | { setMultiple: boolean }
  >
  & Actions<{
    filesSelected: FileList;
    clear: {};
    setAccept: string;
    setMultiple: boolean;
  }>
  & Effects<{
    selected: File[];
    cleared: {};
    acceptChanged: string;
    multipleChanged: boolean;
  }>;

export function fileInputGadget(accept?: string, multiple: boolean = false) {
  return withTaps(defGadget<FileInputSpec>({
    dispatch: (state, input) => {
      if ('filesSelected' in input) return { filesSelected: input.filesSelected };
      if ('clear' in input) return { clear: input.clear };
      if ('setAccept' in input) return { setAccept: input.setAccept };
      if ('setMultiple' in input) return { setMultiple: input.setMultiple };
      return null;
    },

    methods: {
      filesSelected: (gadget, files) => {
        gadget.update({
          ...gadget.current(),
          lastFiles: files
        });

        return {
          selected: Array.from(files)
        };
      },

      clear: (gadget) => {
        const state = gadget.current();
        const newState = { ...state };
        delete newState.lastFiles;
        gadget.update(newState);

        return { cleared: {} };
      },

      setAccept: (gadget, accept) => {
        gadget.update({
          ...gadget.current(),
          accept
        });

        return { acceptChanged: accept };
      },

      setMultiple: (gadget, multiple) => {
        gadget.update({
          ...gadget.current(),
          multiple
        });

        return { multipleChanged: multiple };
      }
    }
  })({
    accept: accept,  // Will be undefined if not provided, which is allowed
    multiple
  } as { accept?: string; multiple: boolean }));
}