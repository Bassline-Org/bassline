/**
 * Connection Effects Tests
 *
 * Tests for WebSocket-based graph connections with automatic context-based sync.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Graph } from '../src/minimal-graph.js';
import { installConnectionEffects, getActiveConnections, getActiveServers, getConnectionInfo } from '../extensions/io-effects-connections.js';
import { isHandled, getOutput } from '../extensions/io-effects.js';

// Helper: wait for effect to complete
async function waitForEffect(graph, effectName, ctx, maxWait = 2000) {
  const startTime = Date.now();
  while (!isHandled(graph, effectName, ctx)) {
    if (Date.now() - startTime > maxWait) {
      throw new Error(`Timeout waiting for ${effectName} to handle ${ctx}`);
    }
    await new Promise(resolve => setTimeout(resolve, 10));
  }
}

// Helper: wait for condition
async function waitFor(condition, maxWait = 2000, checkInterval = 10) {
  const startTime = Date.now();
  while (!condition()) {
    if (Date.now() - startTime > maxWait) {
      throw new Error('Timeout waiting for condition');
    }
    await new Promise(resolve => setTimeout(resolve, checkInterval));
  }
}

describe("Connections - Basic", () => {
  let serverGraph;
  let clientGraph;
  const TEST_PORT = 9876;

  beforeEach(() => {
    serverGraph = new Graph();
    clientGraph = new Graph();
    installConnectionEffects(serverGraph);
    installConnectionEffects(clientGraph);
  });

  afterEach(async () => {
    // Clean up servers and connections
    const servers = getActiveServers();
    for (const serverId of servers) {
      serverGraph.add("cleanup", "SERVER_ID", serverId, null);
      serverGraph.add("cleanup", "handle", "CLOSE_SERVER", "input");
      await waitForEffect(serverGraph, "CLOSE_SERVER", "cleanup", 1000);
    }

    const connections = getActiveConnections();
    for (const connId of connections) {
      clientGraph.add("cleanup", "CONNECTION_ID", connId, null);
      clientGraph.add("cleanup", "handle", "DISCONNECT", "input");
      await waitForEffect(clientGraph, "DISCONNECT", "cleanup", 1000);
    }

    // Small delay for cleanup
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  it("should establish connection with CONNECT", async () => {
    // Start server
    serverGraph.add("server1", "PORT", TEST_PORT, null);
    serverGraph.add("server1", "handle", "LISTEN", "input");
    await waitForEffect(serverGraph, "LISTEN", "server1");

    const serverStatus = getOutput(serverGraph, "server1", "STATUS");
    expect(serverStatus).toBe("LISTENING");

    // Connect client
    clientGraph.add("conn1", "URL", `ws://localhost:${TEST_PORT}`, null);
    clientGraph.add("conn1", "handle", "CONNECT", "input");
    await waitForEffect(clientGraph, "CONNECT", "conn1");

    const connStatus = getOutput(clientGraph, "conn1", "STATUS");
    expect(connStatus).toBe("CONNECTED");

    // Verify connection tracked
    const connections = getActiveConnections();
    expect(connections.length).toBe(1);
  });

  it("should sync quads from bound context to remote", async () => {
    // Start server with bound context
    serverGraph.add("server1", "PORT", TEST_PORT, null);
    serverGraph.add("server1", "BIND_CONTEXT", "from-clients", null);
    serverGraph.add("server1", "handle", "LISTEN", "input");
    await waitForEffect(serverGraph, "LISTEN", "server1");

    // Connect client with bound context
    clientGraph.add("conn1", "URL", `ws://localhost:${TEST_PORT}`, null);
    clientGraph.add("conn1", "BIND_CONTEXT", "to-server", null);
    clientGraph.add("conn1", "handle", "CONNECT", "input");
    await waitForEffect(clientGraph, "CONNECT", "conn1");

    // Add quad to client's bound context
    clientGraph.add("alice", "age", 30, "to-server");

    // Wait for quad to appear in server's bound context
    await waitFor(() => {
      const results = serverGraph.query(["alice", "age", "?a", "from-clients"]);
      return results.length > 0;
    });

    // Verify quad received
    const results = serverGraph.query(["alice", "age", "?a", "from-clients"]);
    expect(results.length).toBe(1);
    expect(results[0].get("?a")).toBe(30);
  });

  it("should support bidirectional communication", async () => {
    // Start server with bound context
    serverGraph.add("server1", "PORT", TEST_PORT, null);
    serverGraph.add("server1", "BIND_CONTEXT", "shared", null);
    serverGraph.add("server1", "handle", "LISTEN", "input");
    await waitForEffect(serverGraph, "LISTEN", "server1");

    // Connect client with same bound context
    clientGraph.add("conn1", "URL", `ws://localhost:${TEST_PORT}`, null);
    clientGraph.add("conn1", "BIND_CONTEXT", "shared", null);
    clientGraph.add("conn1", "handle", "CONNECT", "input");
    await waitForEffect(clientGraph, "CONNECT", "conn1");

    // Client sends to server
    clientGraph.add("alice", "location", "client", "shared");
    await waitFor(() => {
      const results = serverGraph.query(["alice", "location", "?l", "shared"]);
      return results.length > 0;
    });

    let results = serverGraph.query(["alice", "location", "?l", "shared"]);
    expect(results[0].get("?l")).toBe("client");

    // Server sends to client
    serverGraph.add("bob", "location", "server", "shared");
    await waitFor(() => {
      const results = clientGraph.query(["bob", "location", "?l", "shared"]);
      return results.length > 0;
    });

    results = clientGraph.query(["bob", "location", "?l", "shared"]);
    expect(results[0].get("?l")).toBe("server");
  });

  it("should filter effect contexts from sync", async () => {
    // Start server
    serverGraph.add("server1", "PORT", TEST_PORT, null);
    serverGraph.add("server1", "BIND_CONTEXT", "data", null);
    serverGraph.add("server1", "handle", "LISTEN", "input");
    await waitForEffect(serverGraph, "LISTEN", "server1");

    // Connect client
    clientGraph.add("conn1", "URL", `ws://localhost:${TEST_PORT}`, null);
    clientGraph.add("conn1", "BIND_CONTEXT", "data", null);
    clientGraph.add("conn1", "handle", "CONNECT", "input");
    await waitForEffect(clientGraph, "CONNECT", "conn1");

    // Add quads to different contexts
    clientGraph.add("alice", "data-attr", "value1", "data");  // Should sync
    clientGraph.add("bob", "input-attr", "value2", "input");  // Should NOT sync
    clientGraph.add("charlie", "output-attr", "value3", "output");  // Should NOT sync
    clientGraph.add("dave", "system-attr", "value4", "system");  // Should NOT sync
    clientGraph.add("eve", "tomb-attr", "value5", "tombstone");  // Should NOT sync

    // Wait for data context quad
    await waitFor(() => {
      const results = serverGraph.query(["alice", "data-attr", "?v", "*"]);
      return results.length > 0;
    });

    // Give time for any other quads (should not arrive)
    await new Promise(resolve => setTimeout(resolve, 200));

    // Verify only data context quad received
    expect(serverGraph.query(["alice", "data-attr", "?v", "*"]).length).toBe(1);
    expect(serverGraph.query(["bob", "input-attr", "?v", "*"]).length).toBe(0);
    expect(serverGraph.query(["charlie", "output-attr", "?v", "*"]).length).toBe(0);
    expect(serverGraph.query(["dave", "system-attr", "?v", "*"]).length).toBe(0);
    expect(serverGraph.query(["eve", "tomb-attr", "?v", "*"]).length).toBe(0);
  });
});

describe("Connections - Server", () => {
  let serverGraph;
  let client1Graph;
  let client2Graph;
  const TEST_PORT = 9877;

  beforeEach(() => {
    serverGraph = new Graph();
    client1Graph = new Graph();
    client2Graph = new Graph();
    installConnectionEffects(serverGraph);
    installConnectionEffects(client1Graph);
    installConnectionEffects(client2Graph);
  });

  afterEach(async () => {
    // Clean up
    const servers = getActiveServers();
    for (const serverId of servers) {
      serverGraph.add("cleanup", "SERVER_ID", serverId, null);
      serverGraph.add("cleanup", "handle", "CLOSE_SERVER", "input");
      await waitForEffect(serverGraph, "CLOSE_SERVER", "cleanup", 1000);
    }

    const connections = getActiveConnections();
    for (const connId of connections) {
      client1Graph.add("cleanup", "CONNECTION_ID", connId, null);
      client1Graph.add("cleanup", "handle", "DISCONNECT", "input");
      await waitForEffect(client1Graph, "DISCONNECT", "cleanup", 1000);
    }

    await new Promise(resolve => setTimeout(resolve, 100));
  });

  it("should handle multiple clients", async () => {
    // Start server
    serverGraph.add("server1", "PORT", TEST_PORT, null);
    serverGraph.add("server1", "BIND_CONTEXT", "lobby", null);
    serverGraph.add("server1", "handle", "LISTEN", "input");
    await waitForEffect(serverGraph, "LISTEN", "server1");

    // Connect two clients
    client1Graph.add("conn1", "URL", `ws://localhost:${TEST_PORT}`, null);
    client1Graph.add("conn1", "BIND_CONTEXT", "lobby", null);
    client1Graph.add("conn1", "handle", "CONNECT", "input");
    await waitForEffect(client1Graph, "CONNECT", "conn1");

    client2Graph.add("conn2", "URL", `ws://localhost:${TEST_PORT}`, null);
    client2Graph.add("conn2", "BIND_CONTEXT", "lobby", null);
    client2Graph.add("conn2", "handle", "CONNECT", "input");
    await waitForEffect(client2Graph, "CONNECT", "conn2");

    // Verify server has two CLIENT edges
    await waitFor(() => {
      const clients = serverGraph.query([`server-${TEST_PORT}`, "CLIENT", "?id", "output"]);
      return clients.length === 2;
    });

    const clients = serverGraph.query([`server-${TEST_PORT}`, "CLIENT", "?id", "output"]);
    expect(clients.length).toBe(2);
  });

  it("should broadcast from server to all clients", async () => {
    // Start server
    serverGraph.add("server1", "PORT", TEST_PORT, null);
    serverGraph.add("server1", "BIND_CONTEXT", "broadcast", null);
    serverGraph.add("server1", "handle", "LISTEN", "input");
    await waitForEffect(serverGraph, "LISTEN", "server1");

    // Connect two clients
    client1Graph.add("conn1", "URL", `ws://localhost:${TEST_PORT}`, null);
    client1Graph.add("conn1", "BIND_CONTEXT", "broadcast", null);
    client1Graph.add("conn1", "handle", "CONNECT", "input");
    await waitForEffect(client1Graph, "CONNECT", "conn1");

    client2Graph.add("conn2", "URL", `ws://localhost:${TEST_PORT}`, null);
    client2Graph.add("conn2", "BIND_CONTEXT", "broadcast", null);
    client2Graph.add("conn2", "handle", "CONNECT", "input");
    await waitForEffect(client2Graph, "CONNECT", "conn2");

    // Server sends message
    serverGraph.add("announcement", "text", "hello everyone", "broadcast");

    // Wait for both clients to receive
    await waitFor(() => {
      const c1 = client1Graph.query(["announcement", "text", "?t", "broadcast"]);
      const c2 = client2Graph.query(["announcement", "text", "?t", "broadcast"]);
      return c1.length > 0 && c2.length > 0;
    });

    // Verify both received
    const c1Results = client1Graph.query(["announcement", "text", "?t", "broadcast"]);
    const c2Results = client2Graph.query(["announcement", "text", "?t", "broadcast"]);
    expect(c1Results[0].get("?t")).toBe("hello everyone");
    expect(c2Results[0].get("?t")).toBe("hello everyone");
  });

  it("should notify when client disconnects", async () => {
    // Start server
    serverGraph.add("server1", "PORT", TEST_PORT, null);
    serverGraph.add("server1", "handle", "LISTEN", "input");
    await waitForEffect(serverGraph, "LISTEN", "server1");

    // Connect client
    client1Graph.add("conn1", "URL", `ws://localhost:${TEST_PORT}`, null);
    client1Graph.add("conn1", "handle", "CONNECT", "input");
    await waitForEffect(client1Graph, "CONNECT", "conn1");

    // Wait for client connection notification
    await waitFor(() => {
      const clients = serverGraph.query([`server-${TEST_PORT}`, "CLIENT", "?id", "output"]);
      return clients.length === 1;
    });

    const clientId = serverGraph.query([`server-${TEST_PORT}`, "CLIENT", "?id", "output"])[0].get("?id");

    // Disconnect client
    const connId = getOutput(client1Graph, "conn1", "CONNECTION_ID");
    client1Graph.add("disc1", "CONNECTION_ID", connId, null);
    client1Graph.add("disc1", "handle", "DISCONNECT", "input");
    await waitForEffect(client1Graph, "DISCONNECT", "disc1");

    // Wait for disconnect notification
    await waitFor(() => {
      const disconnects = serverGraph.query([`server-${TEST_PORT}`, "DISCONNECTED", clientId, "output"]);
      return disconnects.length > 0;
    });

    const disconnects = serverGraph.query([`server-${TEST_PORT}`, "DISCONNECTED", clientId, "output"]);
    expect(disconnects.length).toBe(1);
  });
});

describe("Connections - Lifecycle", () => {
  let graph1;
  let graph2;
  const TEST_PORT = 9878;

  beforeEach(() => {
    graph1 = new Graph();
    graph2 = new Graph();
    installConnectionEffects(graph1);
    installConnectionEffects(graph2);
  });

  afterEach(async () => {
    // Clean up
    const servers = getActiveServers();
    for (const serverId of servers) {
      graph1.add("cleanup", "SERVER_ID", serverId, null);
      graph1.add("cleanup", "handle", "CLOSE_SERVER", "input");
      await waitForEffect(graph1, "CLOSE_SERVER", "cleanup", 1000);
    }

    await new Promise(resolve => setTimeout(resolve, 100));
  });

  it("should disconnect cleanly with DISCONNECT", async () => {
    // Start server
    graph1.add("server1", "PORT", TEST_PORT, null);
    graph1.add("server1", "handle", "LISTEN", "input");
    await waitForEffect(graph1, "LISTEN", "server1");

    // Connect
    graph2.add("conn1", "URL", `ws://localhost:${TEST_PORT}`, null);
    graph2.add("conn1", "handle", "CONNECT", "input");
    await waitForEffect(graph2, "CONNECT", "conn1");

    const connId = getOutput(graph2, "conn1", "CONNECTION_ID");
    expect(getActiveConnections()).toContain(connId);

    // Disconnect
    graph2.add("disc1", "CONNECTION_ID", connId, null);
    graph2.add("disc1", "handle", "DISCONNECT", "input");
    await waitForEffect(graph2, "DISCONNECT", "disc1");

    const success = getOutput(graph2, "disc1", "SUCCESS");
    expect(success).toBe("TRUE");
    expect(getActiveConnections()).not.toContain(connId);
  });

  it("should close server with CLOSE_SERVER", async () => {
    // Start server
    graph1.add("server1", "PORT", TEST_PORT, null);
    graph1.add("server1", "handle", "LISTEN", "input");
    await waitForEffect(graph1, "LISTEN", "server1");

    const serverId = `server-${TEST_PORT}`;
    expect(getActiveServers()).toContain(serverId);

    // Connect client
    graph2.add("conn1", "URL", `ws://localhost:${TEST_PORT}`, null);
    graph2.add("conn1", "handle", "CONNECT", "input");
    await waitForEffect(graph2, "CONNECT", "conn1");

    // Close server
    graph1.add("close1", "SERVER_ID", serverId, null);
    graph1.add("close1", "handle", "CLOSE_SERVER", "input");
    await waitForEffect(graph1, "CLOSE_SERVER", "close1");

    const success = getOutput(graph1, "close1", "SUCCESS");
    const clientsClosed = getOutput(graph1, "close1", "CLIENTS_CLOSED");
    expect(success).toBe("TRUE");
    expect(clientsClosed).toBe(1);
    expect(getActiveServers()).not.toContain(serverId);
  });

  it("should handle connection errors gracefully", async () => {
    // Try to connect to non-existent server
    graph1.add("conn1", "URL", `ws://localhost:${TEST_PORT}`, null);
    graph1.add("conn1", "handle", "CONNECT", "input");

    // Wait for effect to complete (with error)
    await waitForEffect(graph1, "CONNECT", "conn1", 2000);

    // Should have error in output
    const status = getOutput(graph1, "conn1", "STATUS");
    const error = getOutput(graph1, "conn1", "ERROR");
    expect(status).toBe("ERROR");
    expect(error).toBeDefined();
  });

  it("should return error for non-existent connection disconnect", async () => {
    graph1.add("disc1", "CONNECTION_ID", "fake-conn-id", null);
    graph1.add("disc1", "handle", "DISCONNECT", "input");
    await waitForEffect(graph1, "DISCONNECT", "disc1");

    const success = getOutput(graph1, "disc1", "SUCCESS");
    const error = getOutput(graph1, "disc1", "ERROR");
    expect(success).toBe("FALSE");
    expect(error).toBe("Connection not found");
  });
});

describe("Connections - Metadata", () => {
  let serverGraph;
  let clientGraph;
  const TEST_PORT = 9879;

  beforeEach(() => {
    serverGraph = new Graph();
    clientGraph = new Graph();
    installConnectionEffects(serverGraph);
    installConnectionEffects(clientGraph);
  });

  afterEach(async () => {
    const servers = getActiveServers();
    for (const serverId of servers) {
      serverGraph.add("cleanup", "SERVER_ID", serverId, null);
      serverGraph.add("cleanup", "handle", "CLOSE_SERVER", "input");
      await waitForEffect(serverGraph, "CLOSE_SERVER", "cleanup", 1000);
    }

    await new Promise(resolve => setTimeout(resolve, 100));
  });

  it("should track active connections", async () => {
    expect(getActiveConnections().length).toBe(0);

    // Start server and connect
    serverGraph.add("server1", "PORT", TEST_PORT, null);
    serverGraph.add("server1", "handle", "LISTEN", "input");
    await waitForEffect(serverGraph, "LISTEN", "server1");

    clientGraph.add("conn1", "URL", `ws://localhost:${TEST_PORT}`, null);
    clientGraph.add("conn1", "handle", "CONNECT", "input");
    await waitForEffect(clientGraph, "CONNECT", "conn1");

    expect(getActiveConnections().length).toBe(1);
  });

  it("should track active servers", async () => {
    expect(getActiveServers().length).toBe(0);

    serverGraph.add("server1", "PORT", TEST_PORT, null);
    serverGraph.add("server1", "handle", "LISTEN", "input");
    await waitForEffect(serverGraph, "LISTEN", "server1");

    const servers = getActiveServers();
    expect(servers.length).toBe(1);
    expect(servers[0]).toBe(`server-${TEST_PORT}`);
  });

  it("should provide connection info", async () => {
    serverGraph.add("server1", "PORT", TEST_PORT, null);
    serverGraph.add("server1", "handle", "LISTEN", "input");
    await waitForEffect(serverGraph, "LISTEN", "server1");

    clientGraph.add("conn1", "URL", `ws://localhost:${TEST_PORT}`, null);
    clientGraph.add("conn1", "BIND_CONTEXT", "my-context", null);
    clientGraph.add("conn1", "handle", "CONNECT", "input");
    await waitForEffect(clientGraph, "CONNECT", "conn1");

    const connId = getOutput(clientGraph, "conn1", "CONNECTION_ID");
    const info = getConnectionInfo(connId);

    expect(info).toBeDefined();
    expect(info.id).toBe(connId);
    expect(info.context).toBe("my-context");
    expect(info.readyState).toBe(1); // WebSocket.OPEN
  });
});
