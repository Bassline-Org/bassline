import { WebSocketServer } from "ws";
import { createRuntime } from "./runtime.js";
import { nativeFn, word } from "./prelude/index.js";
import { message, MESSAGES, send, ServerConnection } from "./connections.js";

export class BasslineServer {
    constructor() {
        this.connections = new Map();
        this.runtimes = new Map();
    }
    getRuntime(id, connection) {
        let runtime = this.runtimes.get(id);
        if (!runtime) {
            runtime = createRuntime();
        }
        runtime.context.set(
            "detach",
            nativeFn("", (_context, iter) => {
                console.log("Detaching connection for", id);
                connection.socket.close();
                this.connections.delete(id);
                // Consume the iterator
                iter.toArray();
                return word("true");
            }),
        );
        this.runtimes.set(id, runtime);
        return runtime;
    }
    setupConnection(id, connection) {
        connection.socket.on("message", (msg) => {
            const { type, nonce, data } = JSON.parse(msg);
            if (type === MESSAGES.doit) {
                connection.doit(nonce, data);
            } else {
                console.error("UNKNOWN MESSAGE TYPE: ", type);
            }
        });
        connection.socket.on("error", (error) => {
            connection.error(error.message);
        });
        connection.socket.on("close", () => {
            console.log("Connection closed");
            this.connections.delete(id);
        });
    }
    onConnect(socket, { id }) {
        const connection = new ServerConnection(socket);
        if (!id) {
            return socket.send(
                JSON.stringify(message.connection.err("EXPECTED ID!")),
            );
        }
        if (this.connections.has(id)) {
            return socket.send(
                JSON.stringify(
                    message.connection.err("CONNECTION ALREADY EXISTS!"),
                ),
            );
        }
        this.connections.set(id, connection);
        const runtime = this.getRuntime(id, connection);
        connection.runtime = runtime;
        socket.send(JSON.stringify(message.connection.ok({ id })));
        this.setupConnection(id, connection);
    }
}

export class BasslineWs extends BasslineServer {
    constructor(host, port) {
        super();
        this.server = new WebSocketServer({ port, host });
        this.server.on("connection", (ws) => {
            ws.once("message", (msg) => {
                const { type, data } = JSON.parse(msg);
                if (type !== MESSAGES.connect) {
                    return send(
                        ws,
                        message.connection.err("EXPECTED CONNECT MESSAGE!"),
                    );
                }
                this.onConnect(ws, { id: data });
            });
        });
    }
}
