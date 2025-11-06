/**
 * Built-in IO Effects (Browser-Compatible)
 *
 * Standard effects using the IO contexts pattern.
 * All effects follow the same interface:
 *   executor: async (graph, ctx) => outputs object
 *
 * Usage:
 *   // Setup inputs
 *   graph.add("req1", "MESSAGE", "Hello", null);
 *   // Trigger effect
 *   graph.add("req1", "handle", "LOG", "input");
 *   // Wait for completion
 *   graph.query(["LOG", "handled", "req1", "output"]);
 *   // Read outputs
 *   graph.query(["req1", "?attr", "?val", "output"]);
 */

export const builtinIOEffects = {
  io: {
    LOG: {
      execute: async (graph, ctx) => {
        // Query for MESSAGE input
        const messageQ = graph.query([ctx, "MESSAGE", "?m", "*"]);
        const message = messageQ[0]?.get("?m");

        console.log(message);

        return {
          LOGGED: "TRUE",
          MESSAGE: message
        };
      },
      category: "io",
      doc: "Log message to console. Input: MESSAGE"
    },

    ERROR: {
      execute: async (graph, ctx) => {
        const messageQ = graph.query([ctx, "MESSAGE", "?m", "*"]);
        const message = messageQ[0]?.get("?m");

        console.error(message);

        return {
          LOGGED: "TRUE",
          MESSAGE: message
        };
      },
      category: "io",
      doc: "Log error message to console. Input: MESSAGE"
    },

    WARN: {
      execute: async (graph, ctx) => {
        const messageQ = graph.query([ctx, "MESSAGE", "?m", "*"]);
        const message = messageQ[0]?.get("?m");

        console.warn(message);

        return {
          LOGGED: "TRUE",
          MESSAGE: message
        };
      },
      category: "io",
      doc: "Log warning message to console. Input: MESSAGE"
    }
  },

  http: {
    HTTP_GET: {
      execute: async (graph, ctx) => {
        const urlQ = graph.query([ctx, "URL", "?u", "*"]);
        const url = urlQ[0]?.get("?u");

        if (!url) {
          throw new Error("HTTP_GET requires URL input");
        }

        const response = await fetch(url);
        const data = await response.json();

        return {
          STATUS: response.status,
          DATA: JSON.stringify(data), // Store as string for graph
          OK: response.ok ? "TRUE" : "FALSE"
        };
      },
      category: "http",
      doc: "HTTP GET request returning JSON. Input: URL"
    },

    HTTP_POST: {
      execute: async (graph, ctx) => {
        const urlQ = graph.query([ctx, "URL", "?u", "*"]);
        const url = urlQ[0]?.get("?u");

        const bodyQ = graph.query([ctx, "BODY", "?b", "*"]);
        const body = bodyQ[0]?.get("?b");

        const headersQ = graph.query([ctx, "HEADERS", "?h", "*"]);
        const headersStr = headersQ[0]?.get("?h");
        const headers = headersStr ? JSON.parse(headersStr) : {};

        if (!url) {
          throw new Error("HTTP_POST requires URL input");
        }

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...headers
          },
          body: typeof body === 'string' ? body : JSON.stringify(body)
        });

        const data = await response.json();

        return {
          STATUS: response.status,
          DATA: JSON.stringify(data),
          OK: response.ok ? "TRUE" : "FALSE"
        };
      },
      category: "http",
      doc: "HTTP POST request with JSON body. Inputs: URL, BODY, HEADERS (optional)"
    }
  }
};
