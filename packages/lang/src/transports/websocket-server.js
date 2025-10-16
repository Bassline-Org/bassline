/**
 * WebSocket Server for Node.js
 *
 * Provides WebSocket server for Node.js environments using the 'ws' package
 */

import { WebSocketServer } from "ws";
import { parse } from "../parser.js";

/**
 * Create a WebSocket server
 * @param {number} port - Port to listen on
 * @param {Object} options - Server options
 * @returns {Object} Server handle
 */
export function createWebSocketServer(port, options = {}) {
    const wss = new WebSocketServer({ port, ...options });
    const clients = new Map();
    let clientIdCounter = 0;

    const handlers = {
        connection: new Set(),
        message: new Set(),
        disconnect: new Set(),
        error: new Set(),
    };

    const server = {
        port,
        wss,
        clients,

        /**
         * Start the server
         */
        start() {
            wss.on("connection", (ws, req) => {
                const clientId = `client-${++clientIdCounter}`;
                const clientInfo = {
                    id: clientId,
                    ws,
                    remoteAddress: req.socket.remoteAddress,
                    connectedAt: Date.now(),
                };

                clients.set(clientId, clientInfo);

                // Handle incoming messages
                ws.on("message", (data) => {
                    try {
                        const message = data.toString();
                        handlers.message.forEach((handler) => {
                            try {
                                handler(clientInfo, message);
                            } catch (error) {
                                console.error(
                                    "Error in message handler:",
                                    error,
                                );
                            }
                        });
                    } catch (error) {
                        console.error("Failed to process message:", error);
                    }
                });

                // Handle client disconnect
                ws.on("close", () => {
                    clients.delete(clientId);
                    handlers.disconnect.forEach((handler) => {
                        try {
                            handler(clientInfo);
                        } catch (error) {
                            console.error(
                                "Error in disconnect handler:",
                                error,
                            );
                        }
                    });
                });

                // Handle errors
                ws.on("error", (error) => {
                    console.error(
                        `WebSocket error for client ${clientId}:`,
                        error,
                    );
                    handlers.error.forEach((handler) => {
                        try {
                            handler(clientInfo, error);
                        } catch (err) {
                            console.error("Error in error handler:", err);
                        }
                    });
                });

                // Notify connection handlers
                handlers.connection.forEach((handler) => {
                    try {
                        handler(clientInfo);
                    } catch (error) {
                        console.error("Error in connection handler:", error);
                    }
                });
            });

            console.log(`WebSocket server listening on port ${port}`);
        },

        /**
         * Stop the server
         */
        stop() {
            wss.close();
            clients.clear();
        },

        /**
         * Send a message to a specific client
         * @param {string} clientId - Client ID
         * @param {any} data - Data to send
         */
        send(clientId, data) {
            const client = clients.get(clientId);
            if (!client || client.ws.readyState !== 1) {
                throw new Error(`Client ${clientId} not connected`);
            }

            const message = typeof data === "string"
                ? data
                : JSON.stringify(data);
            client.ws.send(message);
        },

        /**
         * Broadcast a message to all connected clients
         * @param {any} data - Data to send
         */
        broadcast(data) {
            const message = typeof data === "string"
                ? data
                : JSON.stringify(data);
            clients.forEach((client) => {
                if (client.ws.readyState === 1) {
                    client.ws.send(message);
                }
            });
        },

        /**
         * Register an event handler
         * @param {string} event - Event name: "connection", "message", "disconnect", "error"
         * @param {Function} handler - Handler function
         * @returns {Function} Cleanup function
         */
        on(event, handler) {
            if (!handlers[event]) {
                throw new Error(`Unknown event: ${event}`);
            }

            handlers[event].add(handler);

            // Return cleanup function
            return () => {
                handlers[event].delete(handler);
            };
        },

        /**
         * Get server statistics
         */
        getStats() {
            return {
                port,
                clientCount: clients.size,
                clients: Array.from(clients.values()).map((c) => ({
                    id: c.id,
                    remoteAddress: c.remoteAddress,
                    connectedAt: c.connectedAt,
                    uptime: Date.now() - c.connectedAt,
                })),
            };
        },
    };

    return server;
}

/**
 * Create an RPC-style server that handles method calls
 * @param {number} port - Port to listen on
 * @param {Object} methods - Object mapping method names to handler functions
 * @param {Object} options - Server options
 * @returns {Object} RPC server
 */
export function createRPCServer(port, methods = {}, options = {}) {
    const server = createWebSocketServer(port, options);
    server.on("message", async (client, data) => {
        try {
            console.log("message", data);
            const message = parse(data);

            if (message.type === "request" && message.method) {
                const handler = methods[message.method];

                if (!handler) {
                    server.send(client.id, {
                        type: "response",
                        id: message.id,
                        error: `Unknown method: ${message.method}`,
                    });
                    return;
                }

                try {
                    const result = await handler(message.params, client);
                    server.send(client.id, {
                        type: "response",
                        id: message.id,
                        result,
                    });
                } catch (error) {
                    server.send(client.id, {
                        type: "response",
                        id: message.id,
                        error: error.message,
                    });
                }
            }
        } catch (error) {
            console.error("Failed to parse message:", error);
        }
    });

    return {
        server,

        /**
         * Register a method handler
         * @param {string} methodName - Method name
         * @param {Function} handler - Handler function
         */
        registerMethod(methodName, handler) {
            methods[methodName] = handler;
        },

        /**
         * Start the server
         */
        start() {
            server.start();
        },

        /**
         * Stop the server
         */
        stop() {
            server.stop();
        },

        /**
         * Get server statistics
         */
        getStats() {
            return server.getStats();
        },
    };
}
