import { ContextChain, datatype, Str } from "../semantics/default/index.js";
import { parse } from "../parser.js";
import { WebSocketServer } from "ws";
import { WsClient } from "./ws-client.js";
import { Sock } from "./socket.js";
import { TYPES } from "../semantics/default/datatypes/types.js";
import { normalize } from "../utils.js";
import { evaluateBlock } from "../semantics/default/evaluate.js";

TYPES.wsServer = normalize("ws-server!");

export class WsServer extends Sock.typed(TYPES.wsServer) {
    constructor(parent, host, port) {
        super(parent);
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
            clientHandle.openSocket();
            this.id = this.id + 1;
            const sessions = this.get("sessions");
            sessions.set(new Str(key), clientHandle);
            evaluateBlock(parse(`connection "${key}"`), this);
        });
        this.server.on("close", async () => {
            this.closeSocket();
            evaluateBlock(parse("on-close"), this);
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
    moldBody() {
        return this.relevantEntries().map(([key, value]) => {
            return `${key.description}: ${value.mold()}`;
        }).join("\n  ");
    }
    mold() {
        return `in (make ws-server! [${this.get("host").mold()} ${
            this.get("port").mold()
        }]) [ \n  ${this.moldBody()} \n  self ]`;
    }

    static make(values, parent) {
        const [host, port] = values.items;
        return new WsServer(
            parent,
            host.to(TYPES.string),
            port.to(TYPES.number),
        );
    }
}

export default {
    "ws-server!": datatype(WsServer),
};
