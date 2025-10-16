#!/usr/bin/env node
/**
 * Bassline Daemon
 *
 * Runs a Bassline runtime as a WebSocket server
 * Allows remote clients to execute code and interact with the runtime
 */

import { createRepl } from "./repl.js";
import { createRPCServer } from "./transports/websocket-server.js";

const DEFAULT_PORT = 8080;

// Parse command line arguments
const args = process.argv.slice(2);
const port = args.includes("--port")
    ? parseInt(args[args.indexOf("--port") + 1])
    : DEFAULT_PORT;

console.log("🎵 Bassline Daemon");
console.log("==================");
console.log();

// Create REPL instance
const repl = createRepl();
console.log("✓ REPL initialized");

// Get runtime contact
const contactResult = await repl.eval("inspect RUNTIME_CONTACT");
if (contactResult.ok) {
    console.log("✓ Runtime contact:");
    console.log(JSON.stringify(contactResult.value, null, 2));
}

// Create RPC server
const server = createRPCServer(port, {
    // Execute Bassline code
    async eval(params) {
        const { code } = params;
        if (!code) {
            throw new Error("Missing 'code' parameter");
        }

        const result = await repl.eval(code);

        // Serialize the result for transmission
        return {
            ok: result.ok,
            value: result.ok ? (result.value?.mold?.() ?? result.value) : null,
            error: result.error || null,
        };
    },

    // Get context value
    async get(params) {
        const { name } = params;
        if (!name) {
            throw new Error("Missing 'name' parameter");
        }

        const result = await repl.eval(name);
        return {
            ok: result.ok,
            value: result.ok ? (result.value?.mold?.() ?? result.value) : null,
            error: result.error || null,
        };
    },

    // Set context value
    async set(params) {
        const { name, value } = params;
        if (!name) {
            throw new Error("Missing 'name' parameter");
        }

        // Create a set-word expression
        const code = `${name}: ${value?.mold?.() ?? value}`;
        const result = await repl.eval(code);

        return {
            ok: result.ok,
            error: result.error || null,
        };
    },

    // Get runtime contact
    async getContact() {
        const result = await repl.eval("to-contact-json RUNTIME_CONTACT");
        if (result.ok) {
            return JSON.parse(result.value.value);
        }
        throw new Error("Failed to get runtime contact");
    },

    // Ping
    async ping() {
        return { pong: true, timestamp: Date.now() };
    },
});

// Handle connections
server.server.on("connection", (client) => {
    console.log(
        `✓ Client connected: ${client.id} from ${client.remoteAddress}`,
    );
});

server.server.on("disconnect", (client) => {
    console.log(`✗ Client disconnected: ${client.id}`);
});

server.server.on("message", (client, data) => {
    console.log(`✓ Message received: ${data}`);
});

// Start server
server.start();

console.log();
console.log(`✓ WebSocket server listening on ws://localhost:${port}`);
console.log();
console.log("Available RPC methods:");
console.log("  - eval: Execute Bassline code");
console.log("  - get: Get context value");
console.log("  - set: Set context value");
console.log("  - getContact: Get runtime contact info");
console.log("  - ping: Health check");
console.log();
console.log("Press Ctrl+C to stop");

// Handle shutdown gracefully
process.on("SIGINT", () => {
    console.log();
    console.log("Shutting down...");
    server.stop();
    process.exit(0);
});

process.on("SIGTERM", () => {
    console.log();
    console.log("Shutting down...");
    server.stop();
    process.exit(0);
});
