import { WebSocketServer } from "ws";
import { createRuntime } from "./runtime.js";
import { ServerConnection } from "./connections.js";

export class BasslineWs {
    constructor(host, port) {
        this.runtimes = new Map();
        this.connections = new Map();
        this.server = new WebSocketServer({ port, host });
        this.server.on("connection", (socket) => {
            const connection = new ServerConnection(socket);
            connection.on("server-connecting", ({ id }) => {
                connection.setRuntime(this.getRuntime(id));
                connection.on("server-connected", () => {
                    this.connections.set(id, connection);
                });
                connection.on("server-disconnected", () => {
                    this.connections.delete(connection.id);
                });
            });
            connection.on("server-connection-error", (error) => {
                console.error("Connection error: ", error);
            });
        });
    }

    getRuntime(id) {
        let runtime = this.runtimes.get(id);
        if (!runtime) {
            runtime = createRuntime();
        }
        this.runtimes.set(id, runtime);
        return runtime;
    }
}
