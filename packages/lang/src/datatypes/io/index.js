import { ContextChain } from "../context.js";
import { Block, Datatype, nil, Str, Word } from "../core.js";
import { NativeFn } from "../functions.js";
import { normalizeString } from "../../utils.js";
import { parse } from "../../parser.js";
import { Stream } from "../../stream.js";
import { WebSocketServer } from "ws";
import { evaluate } from "../../evaluator.js";
import file from "./file.js";
import process from "./process.js";

/**
 * WebSocket Server Handle
 * Creates a WebSocket server that listens for connections
 */
export class WsServer extends ContextChain {
    static type = normalizeString("ws-server!");

    constructor(host, port, context) {
        super(context);
        this.set("host", host);
        this.set("port", port);
        this.set("clients", new ContextChain(this));
        this.set(
            "listen",
            new NativeFn([], ([], stream, context) => {
                this.listen(this.get("port").value, this.get("host").value);
                return nil;
            }),
        );
        this.id = 0;
    }

    close() {
        this.server.close();
        return nil;
    }

    listen(port, host) {
        if (this.server) return;
        this.server = new WebSocketServer({ port, host });
        this.server.on("connection", (client, request) => {
            const clientHandle = new WsClient(this, client);
            clientHandle.connect();
            this.id = this.id + 1;
            this.get("clients").set(`client-${this.id}`, clientHandle);
            evaluate(parse(`connection ${this.id}`), this);
        });
        this.server.on("error", (error) => {
            evaluate(parse(`error "${error.message}"`), this);
        });
        this.server.on("listening", () => {
            evaluate(parse(`listening ${port}`), this);
        });
    }
    error(message) {
        console.error(message);
        return nil;
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
            `ws-server! [host: ${this.get("host").value} port: ${
                this.get("port").value
            }]`,
        );
    }

    static make(stream, context) {
        const host = stream.next().evaluate(stream, context).to("string!");
        const port = stream.next().evaluate(stream, context).to("number!");
        return new WsServer(host, port, context);
    }
}

/**
 * WebSocket Client Connection Handle (server-side)
 * Represents a single client connection to the server
 */
export class WsClient extends ContextChain {
    static type = normalizeString("ws-client!");

    constructor(context, client) {
        super(context);
        this.client = client;
        this.connected = false;
        this.set(
            "write",
            new NativeFn(["data"], ([data], stream, context) => {
                this.write(data);
                return nil;
            }),
        );
        this.set(
            "close",
            new NativeFn([], ([], stream, context) => {
                this.close();
                return nil;
            }),
        );
        this.set(
            "connect",
            new NativeFn([], ([], stream, context) => {
                this.connect();
                return nil;
            }),
        );
    }

    connect() {
        if (this.connected) return;
        this.connected = true;
        if (!this.client) {
            const url = this.get("url").value;
            const client = new WebSocket(url);
            client.addEventListener("open", (data) => {
                const parsed = parse(`open`);
                evaluate(parsed, this);
                return nil;
            });
            this.client = client;
        }
        this.client.addEventListener("close", () => {
            console.log("close");
            this.closed = true;
            evaluate(parse("close"), this);
            return nil;
        });
        this.client.addEventListener("error", (error) => {
            console.log("error: ", error.message);
            evaluate(parse(`error "${error.message}"`), this);
            return nil;
        });
        this.client.addEventListener("message", (data) => {
            const parsed = parse(`read ${data.data.toString()}`);
            evaluate(parsed, this);
            return nil;
        });
    }

    write(data) {
        console.log("writing: ", data.mold().value);
        this.client.send(data.mold().value);
        return nil;
    }
    close() {
        this.closed = true;
        return nil;
    }
    error(message) {
        console.error(message);
        return nil;
    }

    form() {
        return new Str(`ws-client! [closed: ${this.closed}]`);
    }

    static make(stream, context) {
        return new WsClient(context);
    }
}

// Export datatypes
export default {
    "ws-server!": new Datatype(WsServer),
    "ws-client!": new Datatype(WsClient),
    ...file,
    ...process,
};
