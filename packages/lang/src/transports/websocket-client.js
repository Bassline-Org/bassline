/**
 * WebSocket Client for Browser
 *
 * Provides WebSocket connection management for browser environments
 */

/**
 * Create a WebSocket client connection
 * @param {string} url - WebSocket URL (ws:// or wss://)
 * @param {Object} options - Connection options
 * @returns {Object} Connection handle
 */
export function createWebSocketClient(url, options = {}) {
    let ws = null;
    let reconnectAttempts = 0;
    let reconnectTimer = null;
    let intentionallyClosed = false;

    const maxReconnectAttempts = options.maxReconnectAttempts || 5;
    const reconnectDelay = options.reconnectDelay || 1000;
    const reconnectBackoff = options.reconnectBackoff || 1.5;

    const handlers = {
        open: new Set(),
        message: new Set(),
        error: new Set(),
        close: new Set(),
        reconnect: new Set(),
    };

    const connection = {
        url,
        status: "disconnected",
        ws: null,

        /**
         * Connect to the WebSocket server
         */
        connect() {
            if (ws && (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN)) {
                return; // Already connected or connecting
            }

            intentionallyClosed = false;
            connection.status = "connecting";

            try {
                ws = new WebSocket(url);
                connection.ws = ws;

                ws.onopen = (event) => {
                    connection.status = "connected";
                    reconnectAttempts = 0;
                    handlers.open.forEach(handler => {
                        try {
                            handler(event);
                        } catch (error) {
                            console.error("Error in onopen handler:", error);
                        }
                    });
                };

                ws.onmessage = (event) => {
                    handlers.message.forEach(handler => {
                        try {
                            handler(event.data);
                        } catch (error) {
                            console.error("Error in onmessage handler:", error);
                        }
                    });
                };

                ws.onerror = (event) => {
                    connection.status = "error";
                    handlers.error.forEach(handler => {
                        try {
                            handler(event);
                        } catch (error) {
                            console.error("Error in onerror handler:", error);
                        }
                    });
                };

                ws.onclose = (event) => {
                    connection.status = "disconnected";
                    connection.ws = null;

                    handlers.close.forEach(handler => {
                        try {
                            handler(event);
                        } catch (error) {
                            console.error("Error in onclose handler:", error);
                        }
                    });

                    // Auto-reconnect if not intentionally closed
                    if (!intentionallyClosed && reconnectAttempts < maxReconnectAttempts) {
                        scheduleReconnect();
                    }
                };
            } catch (error) {
                connection.status = "error";
                console.error("Failed to create WebSocket:", error);
            }
        },

        /**
         * Disconnect from the WebSocket server
         */
        disconnect() {
            intentionallyClosed = true;

            if (reconnectTimer) {
                clearTimeout(reconnectTimer);
                reconnectTimer = null;
            }

            if (ws) {
                ws.close();
                ws = null;
            }

            connection.status = "disconnected";
        },

        /**
         * Send a message through the WebSocket
         * @param {any} data - Data to send (will be JSON.stringify'd)
         */
        send(data) {
            if (!ws || ws.readyState !== WebSocket.OPEN) {
                throw new Error("WebSocket is not connected");
            }

            const message = typeof data === "string" ? data : JSON.stringify(data);
            ws.send(message);
        },

        /**
         * Register an event handler
         * @param {string} event - Event name: "open", "message", "error", "close", "reconnect"
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
         * Get connection statistics
         */
        getStats() {
            return {
                url,
                status: connection.status,
                reconnectAttempts,
                readyState: ws ? ws.readyState : null,
            };
        },
    };

    /**
     * Schedule a reconnection attempt with exponential backoff
     */
    function scheduleReconnect() {
        if (reconnectTimer) return;

        const delay = reconnectDelay * Math.pow(reconnectBackoff, reconnectAttempts);
        reconnectAttempts++;

        handlers.reconnect.forEach(handler => {
            try {
                handler({ attempt: reconnectAttempts, delay });
            } catch (error) {
                console.error("Error in reconnect handler:", error);
            }
        });

        reconnectTimer = setTimeout(() => {
            reconnectTimer = null;
            connection.connect();
        }, delay);
    }

    return connection;
}

/**
 * Create a simple RPC-style client that sends requests and receives responses
 * @param {string} url - WebSocket URL
 * @param {Object} options - Connection options
 * @returns {Object} RPC client
 */
export function createRPCClient(url, options = {}) {
    const connection = createWebSocketClient(url, options);
    const pendingRequests = new Map();
    let requestIdCounter = 0;

    connection.on("message", (data) => {
        try {
            const message = JSON.parse(data);

            if (message.type === "response" && message.id) {
                const pending = pendingRequests.get(message.id);
                if (pending) {
                    pendingRequests.delete(message.id);

                    if (message.error) {
                        pending.reject(new Error(message.error));
                    } else {
                        pending.resolve(message.result);
                    }
                }
            }
        } catch (error) {
            console.error("Failed to parse message:", error);
        }
    });

    return {
        connection,

        /**
         * Send an RPC request and wait for response
         * @param {string} method - Method name
         * @param {any} params - Method parameters
         * @returns {Promise<any>} Response
         */
        async call(method, params) {
            return new Promise((resolve, reject) => {
                const id = `req-${++requestIdCounter}`;

                pendingRequests.set(id, { resolve, reject });

                // Timeout after 30 seconds
                setTimeout(() => {
                    if (pendingRequests.has(id)) {
                        pendingRequests.delete(id);
                        reject(new Error("Request timeout"));
                    }
                }, 30000);

                connection.send({
                    type: "request",
                    id,
                    method,
                    params,
                });
            });
        },

        /**
         * Connect to the server
         */
        connect() {
            connection.connect();
        },

        /**
         * Disconnect from the server
         */
        disconnect() {
            connection.disconnect();
        },

        /**
         * Register event handler
         */
        on(event, handler) {
            return connection.on(event, handler);
        },
    };
}
