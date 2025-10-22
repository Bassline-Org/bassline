import {
    ContextChain,
    Datatype,
    NativeFn,
    nil,
    Str,
} from "../prelude/index.js";
import { normalizeString } from "../utils.js";
import { parse } from "../parser.js";
import { WebSocketServer } from "ws";
import { evaluate } from "../evaluator.js";
import { WsClient } from "./ws-client.js";
import { Sock } from "./socket.js";

export class WsServer extends Sock {
    static type = normalizeString("ws-server!");

    constructor(host, port, context) {
        super(context);
        this.set("host", host);
        this.set("port", port);
        this.id = 0;
        this.set("sessions", new ContextChain(this));
    }

    addServerListeners() {
        this.server.on("connection", (client, request) => {
            const key = request.headers["key"];
            if (!key) {
                client.send('error "No key provided!"');
                client.close();
            }
            const clientHandle = new WsClient(this, client);
            clientHandle.open();
            this.id = this.id + 1;
            const sessions = this.get("sessions");
            sessions.set(new Str(key), clientHandle);
            evaluate(parse(`connection "${key}"`), this);
        });
        this.server.on("error", (error) => {
            this.error(error.message);
        });
    }

    open() {
        const port = this.get("port").value;
        const host = this.get("host").value;
        this.server = new WebSocketServer({ port, host });
        this.addServerListeners();
    }

    close() {
        this.server.close();
    }

    error(message) {
        console.error(message);
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

export default {
    "ws-server!": new Datatype(WsServer),
};
