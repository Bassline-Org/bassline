import { Context, Emitter, native } from "../datatypes/index.js";
import { evalNext } from "../evaluator.js";

class WebSocketClient extends Emitter {
    constructor(context) {
        super();
        this.socket = new WebSocket(url);
        this.socket.onmessage = (event) => {
            this.emit("message", event.data);
        };
        this.socket.onerror = (event) => {
            this.emit("error", event.error);
        };
        this.socket.onclose = () => {
            this.emit("close");
        };
    }

    send(data) {
        const molded = data?.mold?.() ?? data;
        this.socket.send(molded);
    }
}

export function installWebsocket(context) {
    context.set(
        "send",
        native(async (stream, context) => {
            const socket = await evalNext(stream, context);
            const data = await evalNext(stream, context);
            socket.send(data);
        }),
    );

    context.set(
        "ws-client",
        native(async (stream, context) => {
            const clientContext = await evalNext(stream, context);
            const url = clientContext.get("url");
            if (!url) {
                throw new Error("url is required");
            }
            const socket = new WebSocketClient(url);
            return socket;
        }),
    );
}
