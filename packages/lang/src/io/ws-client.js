import { datatype, Str } from "../semantics/default/index.js";
import { normalize } from "../utils.js";
import { parse } from "../parser.js";
import { WebSocket } from "ws";
import { Sock } from "./socket.js";
import { TYPES } from "../semantics/default/datatypes/types.js";

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
            evaluateBlock(parsed, this);
        });
        this.client.addEventListener("close", () => {
            this.close();
            const parsed = parse(`on-close`);
            evaluateBlock(parsed, this);
        });

        this.client.addEventListener("error", (error) => {
            this.error(error.message);
        });

        this.client.addEventListener("message", ({ data }) => {
            try {
                const parsed = parse(data);
                evaluateBlock(parsed, this);
            } catch (error) {
                this.error(error.message);
            }
        });
    }
    form() {
        return new Str(`ws-client! [closed: ${this.closed}]`);
    }
    moldBody() {
        return this.relevantEntries().map(([key, value]) => {
            return `${key.description}: ${value.mold()}`;
        }).join("\n  ");
    }
    mold() {
        return `in (make ws-client! self) [ \n  ${this.moldBody()} \n  self ]`;
    }
    static make(parent) {
        return new WsClient(parent);
    }
}

export default {
    "ws-client!": datatype(WsClient),
};
