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
            const key = this.get("key");
            const client = new WebSocket(url, {
                headers: {
                    key: key.to("string!").value,
                },
            });
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
            evaluate(parse(`error "${error.message}"`), this);
            return nil;
        });
        this.client.addEventListener("message", (data) => {
            const parsed = parse(`read ${data.data}`);
            evaluate(parsed, this);
            return nil;
        });
    }

    write(data) {
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

export default {
    "ws-client!": new Datatype(WsClient),
};
