import { datatype, Str } from "../prelude/index.js";
import { normalize } from "../utils.js";
import { parse } from "../parser.js";
import { WebSocket } from "ws";
import { Sock } from "./socket.js";
import { TYPES } from "../prelude/datatypes/types.js";

TYPES.wsClient = normalize("ws-client!");

export class WsClient extends Sock.typed(TYPES.wsClient) {
    constructor(parent, client = null) {
        super(parent);
        if (client) {
            this.client = client;
        }
    }
    buildClient() {
        const url = this.get("url").value;
        const key = this.get("key");
        const client = new WebSocket(url, {
            headers: {
                key: key.to(TYPES.string).value,
            },
        });
        return client;
    }
    open() {
        if (!this.client) {
            this.client = this.buildClient();
        }
        this.addClientListeners();
    }
    send(data) {
        const molded = data?.mold?.();
        if (!molded) return this;
        this.client.send(molded.value);
        return this;
    }
    error(message) {
        console.error(message);
    }
    close() {
        this.client.close();
        this.closed = true;
    }
    addClientListeners() {
        this.client.addEventListener("open", ({ data }) => {
            const parsed = parse(`on-open ${data}`);
            parsed.doBlock(this);
        });
        this.client.addEventListener("close", () => {
            this.close();
            const parsed = parse(`on-close`);
            parsed.doBlock(this);
        });

        this.client.addEventListener("error", (error) => {
            this.error(error.message);
        });

        this.client.addEventListener("message", ({ data }) => {
            try {
                const parsed = parse(data);
                parsed.doBlock(this);
            } catch (error) {
                this.error(error.message);
            }
        });
    }
    form() {
        return new Str(`ws-client! [closed: ${this.closed}]`);
    }
    static make(parent) {
        return new WsClient(parent);
    }
}

export default {
    "ws-client!": datatype(WsClient),
};
