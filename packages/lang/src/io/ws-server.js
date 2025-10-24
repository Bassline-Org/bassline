import { ContextChain, datatype, Str } from "../prelude/index.js";
import { parse } from "../parser.js";
import { WebSocketServer } from "ws";
import { WsClient } from "./ws-client.js";
import { Sock } from "./socket.js";
import { TYPES } from "../prelude/datatypes/types.js";
import { normalize } from "../utils.js";

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
            parse(`connection "${key}"`).doBlock(this);
        });
        this.server.on("close", () => {
            this.closeSocket();
            parse("on-close").doBlock(this);
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
