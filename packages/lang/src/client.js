import { WebSocket } from "ws";
import { TYPES } from "./server.js";
import { randomUUID } from "crypto";

export class BasslineClientConnection {
    constructor(socket) {
        this.socket = socket;
        this.nonce = 0;
        this.requests = new Map();
    }
    nextNonce() {
        this.nonce = this.nonce + 1;
        return this.nonce;
    }
    /// Handlers
    onAttached(data) {
        if (this.attached) return;
        console.log("Attached to server: ", data);
        this.attached = true;
    }
    onResp({ nonce, result }) {
        const request = this.requests.get(nonce);
        if (!request) {
            console.error("NO REQUEST FOUND FOR NONCE: ", nonce);
            return;
        }
        request.resolve(result);
        this.requests.delete(nonce);
    }
    onError(data) {
        console.error("Error: ", data);
    }
    onFatal(data) {
        console.error("Fatal error: ", data);
        this.close();
    }
    req(code) {
        const nonce = this.nextNonce();
        const { promise, resolve, reject } = Promise.withResolvers();
        this.requests.set(nonce, { promise, resolve, reject });
        this.send({ type: TYPES.req, data: { nonce, code } });
        return promise;
    }

    // Handler dispatch
    dispatch(type, data) {
        switch (type) {
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
    }
    // Socket methods
    send(data) {
        if (!this.socket) throw new Error("Not connected");
        this.socket.send(JSON.stringify(data));
    }
    close() {
        if (!this.socket) return;
        this.socket.close();
        this.requests.forEach((request) => {
            request.resolve(null);
        });
        delete this.socket;
    }
}

export async function initConnection(socket, id) {
    const { promise, resolve, reject } = Promise.withResolvers();
    socket.once("message", (msg) => {
        const { type, data } = JSON.parse(msg);
        switch (type) {
            case TYPES.attached:
                console.log("ATTACHED: ", data);
                resolve(data);
                break;
            case TYPES.error:
                console.error("ERROR: ", data);
                reject(new Error("ERROR: " + data));
                break;
            case TYPES.fatal:
                console.error("FATAL: ", data);
                reject(new Error("FATAL: " + data));
                break;
            default:
                console.error("UNKNOWN MESSAGE TYPE:", type);
                reject(new Error("UNKNOWN MESSAGE TYPE: " + type));
                break;
        }
    });
    socket.send(JSON.stringify({ type: TYPES.init, data: { id } }));
    return await promise;
}

export async function wsClient(url, id = randomUUID()) {
    const { promise, resolve, reject } = Promise.withResolvers();
    const socket = new WebSocket(url);
    socket.on("open", async () => {
        const data = await initConnection(socket, id);
        console.log("DATA: ", data);
        resolve(new BasslineClientConnection(socket));
    });
    const connection = await promise;
    socket.on("message", (msg) => {
        const { type, data } = JSON.parse(msg);
        connection.dispatch(type, data);
    });
    socket.on("error", (error) => {
        connection.error(error.message);
    });
    socket.on("close", () => {
        connection.close();
    });
    return connection;
}
