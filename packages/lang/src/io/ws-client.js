import {
    ContextChain,
    Datatype,
    NativeFn,
    nil,
    Str,
} from "../prelude/index.js";
import { normalizeString } from "../utils.js";
import { parse } from "../parser.js";
import { evaluate } from "../evaluator.js";
import { WebSocket } from "ws";
import { Sock } from "./socket.js";

export class WsClient extends Sock {
    static type = normalizeString("ws-client!");
    constructor(context, client) {
        super(context);
        this.client = client;
    }
    buildClient() {
        const url = this.get("url").value;
        const key = this.get("key");
        const client = new WebSocket(url, {
            headers: {
                key: key.to("string!").value,
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
        if (!molded) return nil;
        this.client.send(molded.value);
        return nil;
    }
    error(message) {
        console.error(message);
    }
    close() {
        this.client.close();
        this.closed = true;
    }
    addClientListeners() {
        this.client.addEventListener("open", (data) => {
            const parsed = parse(`on-open`);
            evaluate(parsed, this);
        });
        this.client.addEventListener("close", () => {
            this.close();
            const parsed = parse(`on-close`);
            evaluate(parsed, this);
        });

        this.client.addEventListener("error", (error) => {
            this.error(error.message);
        });

        this.client.addEventListener("message", ({ data }) => {
            try {
                const parsed = parse(data);
                evaluate(parsed, this);
            } catch (error) {
                this.error(error.message);
            }
        });
    }
    form() {
        return new Str(`ws-client! [closed: ${this.closed}]`);
    }
    static make(stream, context) {
        return new WsClient(context);
    }
}

export default {
    "ws-client!": new Datatype(WsClient),
};
