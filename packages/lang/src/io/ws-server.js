import { ContextChain, NativeFn, nil, Str } from "../prelude/index.js";
import { normalizeString } from "../utils.js";
import { parse } from "../parser.js";
import { WebSocketServer } from "ws";
import { evaluate } from "../evaluator.js";
import { WsClient } from "./ws-client.js";

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
