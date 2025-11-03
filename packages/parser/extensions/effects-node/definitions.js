/**
 * Node.js Effect Definitions
 *
 * Filesystem effects that require Node.js runtime.
 * These are opt-in and must be installed separately.
 */

import * as fs from 'fs';

export const nodeEffects = {
  filesystem: {
    READ_FILE: {
      execute: async (path) => {
        const content = await fs.promises.readFile(path, 'utf8');
        return { path, content, bytes: content.length };
      },
      doc: "Read file contents as string"
    },
    WRITE_FILE: {
      execute: async ({ path, content }) => {
        await fs.promises.writeFile(path, content, 'utf8');
        return { path, bytes: content.length };
      },
      doc: "Write string content to file"
    },
    APPEND_FILE: {
      execute: async ({ path, content }) => {
        await fs.promises.appendFile(path, content, 'utf8');
        return { path, bytes: content.length };
      },
      doc: "Append string content to file"
    }
  }
};
