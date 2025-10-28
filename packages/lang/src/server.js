import { WebSocketServer } from "ws";
import { parse } from "./parser.js";
import { createRuntime } from "./runtime.js";
import { nativeFn, word } from "./prelude/index.js";

export async function initServerConnection(socket) {
    const { promise, resolve, reject } = Promise.withResolvers();
    socket.once("message", (msg) => {
        const { type, data } = JSON.parse(msg);
        switch (type) {
            case TYPES.init:
                resolve(data);
                break;
            default:
                console.error("UNKNOWN MESSAGE TYPE:", type);
                reject(new Error("UNKNOWN MESSAGE TYPE: " + type));
                break;
        }
    });
    return await promise;
}

export class BasslineServerConnection {
    constructor(socket, runtime) {
        this.socket = socket;
        this.runtime = runtime;
        this.nonce = 0;
    }
    validNonce(nonce) {
        return nonce > this.nonce;
    }
    nextNonce() {
        return this.nonce++;
    }
    dispatch(type, data) {
        switch (type) {
            case TYPES.req:
                this.onReq(data);
                break;
            default:
                console.error("UNKNOWN MESSAGE TYPE:", type);
                break;
        }
    }
    onReq(data) {
        const { nonce, code } = data;
        if (!this.validNonce(nonce)) {
            return this.error("INVALID NONCE!");
        }
        console.log("Evaluating code", code);
        console.log("Context", this.runtime.context);
        const result = this.runtime.evaluate(code);
        console.log("Result", result);
        this.resp(nonce, result);
        this.nextNonce();
    }
    send(type, data) {
        this?.socket?.send?.(JSON.stringify({ type, data }));
    }
    fatal(data) {
        this.send(TYPES.fatal, data);
        this.socket.close();
    }
    error(data) {
        this.send(TYPES.error, data);
    }
    attached(data) {
        this.send(TYPES.attached, data);
    }
    resp(nonce, result) {
        this.send(TYPES.resp, { nonce, result });
    }
}

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
    createConnection(socket) {
        return new BasslineServerConnection(socket);
    }
    setupConnection(id, connection) {
        connection.socket.on("message", (msg) => {
            const { type, data } = JSON.parse(msg);
            connection.dispatch(type, data);
        });
        connection.socket.on("error", (error) => {
            connection.error(error.message);
        });
        connection.socket.on("close", () => {
            console.log("Connection closed");
            this.connections.delete(id);
        });
    }
    onInit(socket, { id }) {
        const connection = this.createConnection(socket);
        if (!id) {
            return connection.fatal("EXPECTED ID!");
        }
        if (this.connections.has(id)) {
            return connection.fatal("CONNECTION ALREADY EXISTS!");
        }
        this.setupConnection(id, connection);
        const runtime = this.getRuntime(id, connection);
        this.connections.set(id, connection);
        connection.runtime = runtime;
        return connection.attached({ id });
    }
}

export class BasslineWs extends BasslineServer {
    constructor(host, port) {
        super();
        this.server = new WebSocketServer({ port, host });
        this.server.on("connection", (ws) => {
            ws.once("message", (msg) => {
                const { type, data } = JSON.parse(msg);
                if (type !== TYPES.init) {
                    return fatal(ws, "EXPECTED BL_INIT MESSAGE!");
                }
                this.onInit(ws, data);
            });
        });
    }
}

export function fatal(socket, data) {
    socket.send(JSON.stringify({ type: TYPES.fatal, data }));
    socket.close();
}
