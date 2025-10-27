import { WebSocket } from "ws";
import { TYPES } from "./server.js";
import { randomUUID } from "crypto";

export class BasslineWsClient {
    constructor(url, code) {
        this.client = new WebSocket(url);
        this.client.on("open", () => {
            this.init({ id: randomUUID(), code });
        });
        this.client.on("message", (msg) => {
            const { type, data } = JSON.parse(msg);
            switch (type) {
                case TYPES.attached:
                    this.onAttached(data);
                    break;
                case TYPES.error:
                    this.onError(data);
                    break;
                case TYPES.fatal:
                    this.onFatal(data);
                    break;
                case TYPES.resp:
                    this.onResp(data);
                    break;
                default:
                    console.error("UNKNOWN MESSAGE TYPE:", type);
                    break;
            }
        });
    }

    /// Handlers
    onAttached(data) {
        if (this.attached) return;
        console.log("Attached to server: ", data);
        this.attached = true;
    }
    onResp(data) {
        console.log(data);
    }
    onError(data) {
        console.error(data);
    }
    onFatal(data) {
        console.error(data);
        this.client.close();
    }

    /// MESSAGES
    send(data) {
        this.client.send(JSON.stringify(data));
    }
    init(data) {
        this.send({ type: TYPES.init, data });
    }
    req(data) {
        this.send({ type: TYPES.req, data });
    }
}
