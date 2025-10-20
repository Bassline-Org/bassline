import { ContextBase } from "../context.js";
import { Block, Datatype, nil, Str, Word } from "../core.js";
import { normalizeString } from "../../utils.js";
import { parse } from "../../parser.js";
import { Stream } from "../../stream.js";
import { WebSocketServer } from "ws";
import { evaluate } from "../../evaluator.js";

import file from "./file.js";
import process from "./process.js";
/**
 * Base Handle class - all IO resources are handles with event handlers
 *
 * Handles are contexts that:
 * - Have a 'handler' property that receives events as parsed Bassline code
 * - Can be read from and/or written to
 * - Can be closed to cleanup resources
 */
export class Handle extends ContextBase {
    static type = normalizeString("handle!");

    constructor(resource = null) {
        super();
        this.resource = resource;
        this.closed = false;
    }

    /**
     * Call the handler with a string that will be parsed as Bassline code
     * This is the core of the event system - all events are Bassline code
     */
    callHandler(eventStr) {
        if (this.closed) return;

        const parsed = parse(eventStr);
        const block = new Block([new Word("handler"), parsed]);
        try {
            evaluate(block, this);
        } catch (e) {
            console.error("Handler error:", e);
            this.callHandler(`error "${e.message}"`);
        }
    }

    /**
     * Write data to the handle (for writable handles)
     * @param {Str} data - String to write
     */
    write(data) {
        throw new Error(`${this.type} does not support writing`);
    }

    /**
     * Read data from the handle (for readable handles)
     * @returns {Str|nil} - String data or nil
     */
    read() {
        throw new Error(`${this.type} does not support reading`);
    }

    /**
     * Close the handle and cleanup resources
     */
    close() {
        if (this.closed) return nil;
        this.closed = true;
        this.cleanup();
        this.callHandler("closed");
        return nil;
    }

    /**
     * Cleanup resources - override in subclasses
     */
    cleanup() {
        // Override in subclasses to cleanup OS resources
    }

    form() {
        return new Str(
            `handle! [${this.constructor.name} closed: ${this.closed}]`,
        );
    }
}

/**
 * WebSocket Server Handle
 * Creates a WebSocket server that listens for connections
 */
export class WebSocketServerHandle extends Handle {
    static type = normalizeString("websocket-server-handle!");

    constructor(port) {
        super();
        this.clients = new Set();

        this.resource = new WebSocketServer({ port: port.value });

        this.resource.on("connection", (client, request) => {
            // Create a handle for this client connection
            const clientHandle = new WebSocketClientHandle(client, this);
            this.copy(clientHandle);
            this.clients.add(clientHandle);

            // Store latest client in the server context for easy access
            this.set("client", clientHandle);

            // Notify about new connection
            this.callHandler("connection");

            // Cleanup when client disconnects
            client.on("close", () => {
                this.clients.delete(clientHandle);
                clientHandle.closed = true;
            });
        });

        this.resource.on("error", (error) => {
            this.callHandler(`error "${error.message}"`);
        });

        this.resource.on("listening", () => {
            this.callHandler(`listening ${port.value}`);
        });
    }

    /**
     * Broadcast a message to all connected clients
     * @param {Str} str - Message to broadcast
     */
    broadcast(str) {
        const message = str.value;
        for (const client of this.clients) {
            if (!client.closed) {
                client.write(new Str(message));
            }
        }
        return nil;
    }

    cleanup() {
        // Close all client connections
        for (const client of this.clients) {
            client.close();
        }
        // Close the server
        this.resource.close();
    }

    form() {
        return new Str(
            `websocket-server-handle! [port: ${this.resource.options?.port} clients: ${this.clients.size}]`,
        );
    }
}

/**
 * WebSocket Client Connection Handle (server-side)
 * Represents a single client connection to the server
 */
class WebSocketClientHandle extends Handle {
    static type = normalizeString("websocket-client-handle!");

    constructor(wsClient, server) {
        super(wsClient);
        this.server = server;

        // Setup event handlers for this client
        wsClient.on("message", (data) => {
            // First notify this client handle's handler
            this.callHandler(`${data}`);

            // Then notify the server with client context
            // This allows the server to handle messages from any client
            this.server.set("client", this);
            this.server.callHandler(`client-message ${data}`);
        });

        wsClient.on("close", () => {
            this.closed = true;
            this.callHandler("close");

            // Notify server about client disconnect
            this.server.set("client", this);
            this.server.callHandler("client-close");
        });

        wsClient.on("error", (error) => {
            this.callHandler(`error "${error.message}"`);

            // Also notify server
            this.server.set("client", this);
            this.server.callHandler(`client-error "${error.message}"`);
        });
    }

    write(str) {
        if (this.closed) throw new Error("Client connection is closed");
        this.resource.send(str.value);
        return nil;
    }

    cleanup() {
        this.resource.close();
    }

    form() {
        return new Str(`websocket-client-handle! [closed: ${this.closed}]`);
    }
}

// Export datatypes
export default {
    "handle!": new Datatype(Handle),
    "websocket-server-handle!": new Datatype(WebSocketServerHandle),
    //"websocket-client-handle!": new Datatype(WebSocketClientHandle),
    ...file,
    ...process,
};
