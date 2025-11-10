/**
 * Graph Connections via IO Effects
 *
 * WebSocket-based connections between graphs with automatic context-based sync.
 * Any quad added to a bound context is automatically sent over the wire.
 *
 * Usage:
 *   // Client: Connect and bind context
 *   graph.add("conn1", "URL", "ws://remote:8080", null);
 *   graph.add("conn1", "BIND_CONTEXT", "remote-peer", null);
 *   graph.add("conn1", "handle", "CONNECT", "input");
 *
 *   // Add to bound context → automatically sent
 *   graph.add("alice", "AGE", 30, "remote-peer");
 *
 *   // Server: Listen and bind context
 *   graph.add("server1", "PORT", 8080, null);
 *   graph.add("server1", "BIND_CONTEXT", "from-clients", null);
 *   graph.add("server1", "handle", "LISTEN", "input");
 */

import { WebSocket, WebSocketServer } from 'ws';
import { installIOEffect, getInput } from './io-effects.js';
import {
  matchGraph,
  pattern as pat,
  patternQuad as pq,
} from "../src/algebra/pattern.js";
import { variable as v, word as w } from "../src/types.js";

// Connection registry: connectionId → { ws, unwatch, context }
const connections = new Map();

// Server registry: serverId → { wss, clients: Map<clientId, {ws, unwatch}> }
const servers = new Map();

/**
 * Check if a context is an effect context (should not be sent)
 *
 * @param {string} context - Context to check
 * @returns {boolean} True if it's an effect context
 */
function isEffectContext(context) {
  return context === "input" ||
         context === "output" ||
         context === "system" ||
         context === "tombstone";
}

/**
 * Watch a context and call sendFn for non-effect quads
 *
 * @param {Graph} graph - The graph instance
 * @param {string} contextName - Context to watch
 * @param {Function} sendFn - Function to call with quad: [s, a, t, c]
 * @returns {Function} Unwatch function
 */
function watchContext(graph, contextName, sendFn) {
  return graph.watch({
    pattern: pat(pq(v("s"), v("a"), v("t"), w(contextName))),
    production: (bindings) => {
      const quad = [
        bindings.get("s"),
        bindings.get("a"),
        bindings.get("t"),
        null  // Send without context - receiver will use bind context
      ];

      // Don't send effect contexts
      if (!isEffectContext(contextName)) {
        sendFn(quad);
      }

      return [];  // No quads to add to graph
    }
  });
}

/**
 * CONNECT Effect - Connect to remote graph
 *
 * Establishes WebSocket connection and optionally binds a context for auto-sync.
 * Any quad added to the bound context is automatically sent to the remote.
 */
const CONNECT = {
  execute: async (graph, ctx) => {
    const url = getInput(graph, ctx, "URL");
    const bindContext = getInput(graph, ctx, "BIND_CONTEXT");

    if (!url) {
      throw new Error("CONNECT requires URL input");
    }

    const connId = `conn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Create WebSocket connection
    const ws = new WebSocket(url);

    // Wait for connection to open
    await new Promise((resolve, reject) => {
      ws.on('open', resolve);
      ws.on('error', reject);
    });

    // Receive quads from remote → add to graph
    ws.on('message', (data) => {
      try {
        const [s, a, t, c] = JSON.parse(data.toString());
        // Add with original context or bind context
        graph.add(s, a, t, c || bindContext || connId);
      } catch (error) {
        console.error('[CONNECT] Failed to parse message:', error);
      }
    });

    // Handle connection errors
    ws.on('error', (error) => {
      console.error(`[CONNECT] Connection ${connId} error:`, error);
    });

    // Handle disconnection
    ws.on('close', () => {
      // Clean up connection
      const conn = connections.get(connId);
      if (conn && conn.unwatch) {
        conn.unwatch();
      }
      connections.delete(connId);

      // Notify graph
      graph.add(connId, "STATUS", "DISCONNECTED", "output");
    });

    // Watch bound context for quads to send
    let unwatch;
    if (bindContext) {
      unwatch = watchContext(graph, bindContext, (quad) => {
        try {
          ws.send(JSON.stringify(quad));
        } catch (error) {
          console.error('[CONNECT] Failed to send quad:', error);
        }
      });
    }

    // Store connection
    connections.set(connId, { ws, unwatch, context: bindContext });

    return {
      CONNECTION_ID: connId,
      STATUS: "CONNECTED",
      URL: url,
      BIND_CONTEXT: bindContext || "none"
    };
  },
  category: "network",
  doc: "Connect to remote graph. Inputs: URL, BIND_CONTEXT (optional)"
};

/**
 * LISTEN Effect - Start WebSocket server
 *
 * Starts a WebSocket server and optionally binds a context for received quads.
 * Each client connection is tracked and can be queried.
 */
const LISTEN = {
  execute: async (graph, ctx) => {
    const port = getInput(graph, ctx, "PORT");
    const bindContext = getInput(graph, ctx, "BIND_CONTEXT");

    if (!port) {
      throw new Error("LISTEN requires PORT input");
    }

    const serverId = `server-${port}`;

    // Check if server already exists
    if (servers.has(serverId)) {
      throw new Error(`Server already listening on port ${port}`);
    }

    // Create WebSocket server
    const wss = new WebSocketServer({ port });
    const clients = new Map();

    // Handle new client connections
    wss.on('connection', (ws, req) => {
      const clientId = `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // Notify graph of new client
      graph.add(serverId, "CLIENT", clientId, "output");

      // Receive quads from client → add to graph
      ws.on('message', (data) => {
        try {
          const [s, a, t, c] = JSON.parse(data.toString());
          // Add with original context, bind context, or client-specific context
          graph.add(s, a, t, c || bindContext || clientId);
        } catch (error) {
          console.error(`[LISTEN] Client ${clientId} sent invalid data:`, error);
        }
      });

      // Handle client errors
      ws.on('error', (error) => {
        console.error(`[LISTEN] Client ${clientId} error:`, error);
      });

      // Handle client disconnection
      ws.on('close', () => {
        // Clean up client
        const client = clients.get(clientId);
        if (client && client.unwatch) {
          client.unwatch();
        }
        clients.delete(clientId);

        // Notify graph
        graph.add(serverId, "DISCONNECTED", clientId, "output");
      });

      // Watch bind context for quads to send to this client
      let unwatch;
      if (bindContext) {
        unwatch = watchContext(graph, bindContext, (quad) => {
          try {
            ws.send(JSON.stringify(quad));
          } catch (error) {
            console.error(`[LISTEN] Failed to send to client ${clientId}:`, error);
          }
        });
      }

      // Store client connection
      clients.set(clientId, { ws, unwatch });
    });

    // Handle server errors
    wss.on('error', (error) => {
      console.error(`[LISTEN] Server ${serverId} error:`, error);
    });

    // Wait for server to be ready
    await new Promise((resolve) => {
      wss.on('listening', resolve);
    });

    // Store server
    servers.set(serverId, { wss, clients });

    return {
      SERVER_ID: serverId,
      PORT: port,
      STATUS: "LISTENING",
      BIND_CONTEXT: bindContext || "per-client"
    };
  },
  category: "network",
  doc: "Start WebSocket server. Inputs: PORT, BIND_CONTEXT (optional)"
};

/**
 * DISCONNECT Effect - Close connection
 *
 * Closes a WebSocket connection and cleans up watchers.
 */
const DISCONNECT = {
  execute: async (graph, ctx) => {
    const connId = getInput(graph, ctx, "CONNECTION_ID");

    if (!connId) {
      throw new Error("DISCONNECT requires CONNECTION_ID input");
    }

    const conn = connections.get(connId);

    if (!conn) {
      return {
        SUCCESS: "FALSE",
        ERROR: "Connection not found",
        CONNECTION_ID: connId
      };
    }

    // Stop watching context
    if (conn.unwatch) {
      conn.unwatch();
    }

    // Close WebSocket
    conn.ws.close();

    // Remove from registry
    connections.delete(connId);

    return {
      SUCCESS: "TRUE",
      CONNECTION_ID: connId
    };
  },
  category: "network",
  doc: "Close connection. Input: CONNECTION_ID"
};

/**
 * CLOSE_SERVER Effect - Stop WebSocket server
 *
 * Stops a WebSocket server and closes all client connections.
 */
const CLOSE_SERVER = {
  execute: async (graph, ctx) => {
    const serverId = getInput(graph, ctx, "SERVER_ID");

    if (!serverId) {
      throw new Error("CLOSE_SERVER requires SERVER_ID input");
    }

    const server = servers.get(serverId);

    if (!server) {
      return {
        SUCCESS: "FALSE",
        ERROR: "Server not found",
        SERVER_ID: serverId
      };
    }

    // Close all client connections
    for (const [clientId, client] of server.clients) {
      if (client.unwatch) {
        client.unwatch();
      }
      client.ws.close();
    }

    // Close server
    await new Promise((resolve) => {
      server.wss.close(resolve);
    });

    // Remove from registry
    servers.delete(serverId);

    return {
      SUCCESS: "TRUE",
      SERVER_ID: serverId,
      CLIENTS_CLOSED: server.clients.size
    };
  },
  category: "network",
  doc: "Stop WebSocket server. Input: SERVER_ID"
};

/**
 * Built-in connection effects
 */
export const connectionEffects = {
  network: {
    CONNECT,
    LISTEN,
    DISCONNECT,
    CLOSE_SERVER
  }
};

/**
 * Install all connection effects
 *
 * @param {Graph} graph - The graph instance
 * @returns {Map} Map of effect names to unwatch functions
 */
export function installConnectionEffects(graph) {
  const unwatchMap = new Map();

  for (const [name, def] of Object.entries(connectionEffects.network)) {
    const unwatch = installIOEffect(graph, name, def.execute, {
      category: def.category,
      doc: def.doc
    });
    unwatchMap.set(name, unwatch);
  }

  return unwatchMap;
}

/**
 * Get active connections
 *
 * @param {Graph} graph - The graph instance
 * @returns {Array<string>} List of connection IDs
 */
export function getActiveConnections() {
  return Array.from(connections.keys());
}

/**
 * Get active servers
 *
 * @param {Graph} graph - The graph instance
 * @returns {Array<string>} List of server IDs
 */
export function getActiveServers() {
  return Array.from(servers.keys());
}

/**
 * Get connection info
 *
 * @param {string} connId - Connection ID
 * @returns {Object|null} Connection info or null if not found
 */
export function getConnectionInfo(connId) {
  const conn = connections.get(connId);
  if (!conn) return null;

  return {
    id: connId,
    context: conn.context,
    readyState: conn.ws.readyState
  };
}
