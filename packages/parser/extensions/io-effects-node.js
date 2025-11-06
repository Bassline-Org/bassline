/**
 * Built-in IO Effects (Node.js-Specific)
 *
 * Filesystem effects using the IO contexts pattern.
 * These require Node.js runtime (fs module).
 *
 * All effects follow the same interface:
 *   executor: async (graph, ctx) => outputs object
 *
 * Usage:
 *   // Read file
 *   graph.add("req1", "PATH", "/tmp/data.txt", null);
 *   graph.add("req1", "handle", "READ_FILE", "input");
 *   // Result: graph.query(["req1", "CONTENT", "?c", "output"])
 *
 *   // Write file
 *   graph.add("req2", "PATH", "/tmp/output.txt", null);
 *   graph.add("req2", "CONTENT", "Hello World", null);
 *   graph.add("req2", "handle", "WRITE_FILE", "input");
 *   // Result: graph.query(["req2", "SUCCESS", "?s", "output"])
 *
 *   // Append to file
 *   graph.add("req3", "PATH", "/tmp/log.txt", null);
 *   graph.add("req3", "CONTENT", "New log entry\n", null);
 *   graph.add("req3", "handle", "APPEND_FILE", "input");
 */

import { promises as fs } from 'fs';
import { getInput } from './io-effects.js';

export const builtinNodeEffects = {
  filesystem: {
    READ_FILE: {
      execute: async (graph, ctx) => {
        const path = getInput(graph, ctx, "PATH");

        if (!path) {
          throw new Error("READ_FILE requires PATH input");
        }

        try {
          const content = await fs.readFile(path, 'utf8');
          return {
            CONTENT: content,
            SUCCESS: "TRUE",
            PATH: path
          };
        } catch (error) {
          return {
            ERROR: error.message,
            SUCCESS: "FALSE",
            PATH: path
          };
        }
      },
      category: "filesystem",
      doc: "Read file contents as UTF-8 string. Input: PATH"
    },

    WRITE_FILE: {
      execute: async (graph, ctx) => {
        const path = getInput(graph, ctx, "PATH");
        const content = getInput(graph, ctx, "CONTENT");

        if (!path) {
          throw new Error("WRITE_FILE requires PATH input");
        }
        if (content === undefined) {
          throw new Error("WRITE_FILE requires CONTENT input");
        }

        try {
          await fs.writeFile(path, content, 'utf8');
          return {
            SUCCESS: "TRUE",
            PATH: path,
            BYTES: Buffer.byteLength(content, 'utf8')
          };
        } catch (error) {
          return {
            ERROR: error.message,
            SUCCESS: "FALSE",
            PATH: path
          };
        }
      },
      category: "filesystem",
      doc: "Write content to file (overwrites existing). Inputs: PATH, CONTENT"
    },

    APPEND_FILE: {
      execute: async (graph, ctx) => {
        const path = getInput(graph, ctx, "PATH");
        const content = getInput(graph, ctx, "CONTENT");

        if (!path) {
          throw new Error("APPEND_FILE requires PATH input");
        }
        if (content === undefined) {
          throw new Error("APPEND_FILE requires CONTENT input");
        }

        try {
          await fs.appendFile(path, content, 'utf8');
          return {
            SUCCESS: "TRUE",
            PATH: path,
            BYTES: Buffer.byteLength(content, 'utf8')
          };
        } catch (error) {
          return {
            ERROR: error.message,
            SUCCESS: "FALSE",
            PATH: path
          };
        }
      },
      category: "filesystem",
      doc: "Append content to file (creates if doesn't exist). Inputs: PATH, CONTENT"
    }
  }
};
