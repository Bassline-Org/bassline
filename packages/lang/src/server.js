import { WebSocketServer } from "ws";
import { parse } from "./parser.js";
import { createRuntime } from "./runtime.js";

export const TYPES = {
    init: "BL_INIT",
    attached: "BL_ATTACHED",
    req: "BL_REQ",
    resp: "BL_RESP",
    error: "BL_ERROR",
    fatal: "BL_FATAL",
};

export class BasslineWs {
    constructor(host, port) {
        this.server = new WebSocketServer({ port, host });
        this.instances = new Map();
        this.server.on("connection", (ws) => {
            this.onConnection(ws);
        });
    }
    onConnection(ws) {
        ws.once("message", (msg) => {
            const { type, data } = JSON.parse(msg);
            if (type !== TYPES.init) {
                this.error(ws, "EXPECTED BL_INIT MESSAGE!");
                ws.close();
                return;
            }
            this.onInit(ws, data);
        });
    }
    onInit(ws, data) {
        const { id, code } = data;
        if (!id) {
            return this.fatal(ws, "EXPECTED ID!");
        }
        if (!code) {
            return this.fatal(ws, "EXPECTED CODE!");
        }
        let context;
        try {
            context = createRuntime();
            context.evaluate(parse(code));
        } catch (error) {
            return this.fatal(ws, error.message);
        }
        ws.on("message", (msg) => {
            const { type, data } = JSON.parse(msg);
            if (type === TYPES.req) {
                const { nonce, code } = data;
                const result = context.evaluate(parse(code));
                this.resp(ws, { id, nonce, result });
            } else {
                this.error(ws, "EXPECTED BL_REQ MESSAGE!");
            }
        });
        this.attached(ws, { id });
    }

    /// RESPONSES
    resp(ws, data) {
        this.send(ws, { type: TYPES.resp, data });
    }
    attached(ws, data) {
        this.send(ws, { type: TYPES.attached, data });
    }
    error(ws, data) {
        this.send(ws, { type: TYPES.error, data });
    }
    fatal(ws, data) {
        this.send(ws, { type: TYPES.fatal, data });
        ws.close();
        return;
    }
    send(ws, data) {
        ws.send(JSON.stringify(data));
    }
}
