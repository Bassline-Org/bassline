/**
 * This file contains the protocols and messages for the connections.
 *
 * The protocol for bassline connections is inspired by 9p.
 * Clients and servers are simply roles in the connection.
 * A client initiates the connection by sending a REQ_CONNECT message.
 * The server responds with RES_CONNECT_OK or RES_CONNECT_ERR.
 * If the server responds with OK, the connection is established,
 * and all further messages are sent using DO messages
 *
 * @typedef {"client-connecting" | "client-connected" | "client-connection-error" | "client-disconnected"} ClientConnectionEvent
 * @typedef {"server-connecting" | "server-connected" | "server-connection-error" | "server-disconnected"} ServerConnectionEvent
 * @typedef {"client-requested" | "client-evaluated-ok" | "client-evaluated-err"} ClientEvaluationEvent
 * @typedef {"server-runtime-set" | "server-received-request" | "server-evaluated-ok" | "server-evaluated-err"} ServerEvaluationEvent
 * @typedef {ClientConnectionEvent | ClientEvaluationEvent} ClientEvent
 * @typedef {ServerConnectionEvent | ServerEvaluationEvent} ServerEvent
 */

export class ClientConnection extends EventTarget {
    constructor(socket, id) {
        super();
        this.socket = socket;
        this.id = id;
        this.requests = new Map();
        this.nonce = 0;
        this.state = "connecting";

        socket.on("open", () => {
            socket.send(JSON.stringify({ type: "CONNECT", data: id }));
            this.emit("client-connecting");
        });

        socket.on("message", (msg) => {
            const { type, nonce, data } = JSON.parse(msg);
            if (this.state === "connecting") {
                if (type === "CONNECTION_OK") {
                    this.state = "connected";
                    return this.emit("client-connected");
                }
                if (type === "CONNECTION_ERR") {
                    this.socket.close();
                    return this.emit(
                        "client-connection-error",
                        data,
                    );
                }
                return console.error("UNKNOWN MESSAGE TYPE: ", type, data);
            }

            if (this.state === "connected") {
                if (type === "DIDIT_OK") {
                    const request = this.requests.get(nonce);
                    if (request) {
                        request.resolve(data);
                        this.requests.delete(nonce);
                        this.emit("client-evaluated-ok", nonce);
                        return;
                    }
                    console.error("NO REQUEST FOUND FOR NONCE: ", nonce);
                    return;
                }

                if (type === "DIDIT_ERR") {
                    const request = this.requests.get(nonce);
                    if (request) {
                        request.reject(new Error(data));
                        this.requests.delete(nonce);
                        this.emit("client-evaluated-err", data);
                        return;
                    }
                    console.error("NO REQUEST FOUND FOR NONCE: ", nonce);
                    return;
                }
                console.error("UNKNOWN MESSAGE: ", type, data);
                return;
            }

            console.error("UNKNOWN STATE: ", this.state, type, data);
            return;
        });

        socket.on("close", () => {
            this.state = "disconnected";
            this.emit("client-disconnected");
        });

        socket.on("error", (e) => {
            this.state = "error";
            this.emit("client-connection-error", e.message);
        });
    }
    /**
     * @param {ClientEvent} event
     * @param {any} data
     */
    emit(event, data) {
        this.dispatchEvent(new CustomEvent(event, { detail: data }));
    }

    /**
     * @param {ClientEvent} event
     * @param {(event: ClientEvent) => void} callback
     * @returns {() => void}
     */
    on(event, callback) {
        this.addEventListener(event, (e) => callback(e.detail));
        return () => this.removeEventListener(event, callback);
    }

    async doit(code) {
        if (this.state !== "connected") {
            return new Promise((resolve, reject) => {
                this.on("client-connected", () => {
                    resolve(this.doit(code));
                });
                this.on("client-connection-error", (error) => {
                    reject(error);
                });
            });
        }
        const nonce = ++this.nonce;
        const { promise, resolve, reject } = Promise.withResolvers();
        this.requests.set(nonce, { resolve, reject });
        this.socket.send(JSON.stringify({ type: "DOIT", nonce, data: code }));
        return promise;
    }
    close() {
        this.socket.close();
        this.state = "disconnected";
        this.emit("client-disconnected");
    }
}

export class ServerConnection extends EventTarget {
    constructor(socket) {
        super();
        this.socket = socket;
        this.state = "connecting";

        socket.on("message", (msg) => {
            const { type, nonce, data } = JSON.parse(msg);
            console.log("SERVER MESSAGE: ", type, nonce, data);
            if (this.state === "connecting") {
                if (type === "CONNECT") {
                    this.id = data;
                    this.emit("server-connecting", { id: this.id });
                    socket.send(
                        JSON.stringify({
                            type: "CONNECTION_OK",
                            data: { id: this.id },
                        }),
                    );
                    this.state = "connected";
                    this.emit("server-connected", { id: this.id });
                    return;
                }
                if (type === "CONNECTION_ERR") {
                    this.socket.close();
                    return this.emit("server-connection-error", data);
                }
                console.error("UNKNOWN MESSAGE TYPE: ", type, data);
                return;
            }

            if (this.state === "connected") {
                if (type === "DOIT") {
                    try {
                        const result = this.runtime.evaluate(data);
                        this.socket.send(JSON.stringify({
                            type: "DIDIT_OK",
                            nonce: nonce,
                            data: result?.mold() || '""',
                        }));
                        this.emit("server-evaluated-ok", nonce);
                        return;
                    } catch (e) {
                        this.socket.send(JSON.stringify({
                            type: "DIDIT_ERR",
                            nonce: nonce,
                            data: e.message,
                        }));
                        this.emit("server-evaluated-err", e.message);
                        return;
                    }
                }
                console.error("UNKNOWN MESSAGE TYPE: ", type, data);
                return;
            }

            console.error("UNKNOWN STATE: ", this.state, type, data);
            return;
        });

        socket.on("close", () => {
            this.state = "disconnected";
            this.emit("server-disconnected");
        });

        socket.on("error", (e) => {
            this.state = "error";
            this.emit("server-connection-error", e.message);
        });
    }
    setRuntime(runtime) {
        this.runtime = runtime;
        this.emit("server-runtime-set", runtime);
    }
    /**
     * @param {ServerEvent} event
     * @param {any} data
     */
    emit(event, data) {
        this.dispatchEvent(new CustomEvent(event, { detail: data }));
    }
    /**
     * @param {ServerEvent} event
     * @param {(event: ServerEvent) => void} callback
     * @returns {() => void}
     */
    on(event, callback) {
        this.addEventListener(event, (e) => callback(e.detail));
        return () => this.removeEventListener(event, callback);
    }
}
