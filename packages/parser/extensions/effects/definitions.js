/**
 * Effect Definitions (Core)
 *
 * Data-driven definitions for side-effecting operations.
 * Each effect is a pure function specification with execution logic.
 *
 * Core effects are browser-compatible (console, HTTP).
 * For Node.js-specific effects (filesystem), see extensions/effects-node.
 */

export const builtinEffects = {
  io: {
    LOG: {
      execute: (message) => {
        console.log(message);
        return { logged: true, message };
      },
      doc: "Log message to console"
    },
    ERROR: {
      execute: (message) => {
        console.error(message);
        return { logged: true, message };
      },
      doc: "Log error message to console"
    },
    WARN: {
      execute: (message) => {
        console.warn(message);
        return { logged: true, message };
      },
      doc: "Log warning message to console"
    }
  },

  http: {
    HTTP_GET: {
      execute: async (url) => {
        const response = await fetch(url);
        const data = await response.json();
        return { status: response.status, data };
      },
      doc: "HTTP GET request returning JSON"
    },
    HTTP_POST: {
      execute: async ({ url, body, headers = {} }) => {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...headers },
          body: JSON.stringify(body)
        });
        const data = await response.json();
        return { status: response.status, data };
      },
      doc: "HTTP POST request with JSON body"
    }
  }
};
