/**
 * This file contains the protocols and messages for the connections.
 *
 * The protocol for bassline connections is inspired by 9p.
 * Clients and servers are simply roles in the connection.
 * A client initiates the connection by sending a REQ_CONNECT message.
 * The server responds with RES_CONNECT_OK or RES_CONNECT_ERR.
 * If the server responds with OK, the connection is established,
 * and all further messages are sent using DO messages
 */

export class ClientConnection {
    constructor(socket) {
        this.socket = socket;
        this.requests = new Map();
        this.nonce = 0;
    }
    nextNonce() {
        this.nonce = this.nonce + 1;
        return this.nonce;
    }
    async doit(data) {
        const nonce = this.nextNonce();
        const { promise, resolve, reject } = Promise.withResolvers();
        this.requests.set(nonce, { promise, resolve, reject });
        send(this.socket, message.doit(nonce, data));
        return promise;
    }
    didit(nonce, data) {
        const request = this.requests.get(nonce);
        if (!request) {
            console.error("NO REQUEST FOUND FOR NONCE: ", nonce);
            return;
        }
        request.resolve(data);
        this.requests.delete(nonce);
    }
    close() {
        console.log("Closing client connection");
        this.socket.close();
        this.requests.forEach((request) => request.reject("Connection closed"));
        this.requests.clear();
    }
}

export class ServerConnection {
    constructor(socket, runtime) {
        this.socket = socket;
        this.runtime = runtime;
        this.nonce = 0;
    }
    validNonce(nonce) {
        if (nonce > this.nonce) {
            this.nonce = nonce;
            return true;
        }
        return false;
    }
    doit(nonce, data) {
        if (!this.validNonce(nonce)) {
            console.log("Invalid nonce: ", nonce);
            return;
        }
        try {
            const result = this.runtime.evaluate(data);
            if (result === null || result === undefined) {
                this.didit(nonce, `"No result"`, false);
                return;
            }
            this.didit(nonce, result.mold(), false);
        } catch (e) {
            console.error("Error evaluating: ", nonce, data, e);
            this.didit(nonce, `"${e.message}"`, true);
        }
    }
    didit(nonce, data, isErr) {
        send(
            this.socket,
            isErr
                ? message.didit.err(nonce, data)
                : message.didit.ok(nonce, data),
        );
    }
}

export const MESSAGES = {
    connect: "CONNECT",
    connection: {
        ok: "CONNECTION_OK",
        err: "CONNECTION_ERR",
    },
    doit: "DOIT",
    didit: {
        ok: "DIDIT_OK",
        err: "DIDIT_ERR",
    },
};

export const message = {
    connect: (data) => ({ type: MESSAGES.connect, data }),
    connection: {
        ok: (data) => ({ type: MESSAGES.connection.ok, data }),
        err: (data) => ({ type: MESSAGES.connection.err, data }),
    },
    doit: (nonce, data) => ({ type: MESSAGES.doit, nonce, data }),
    didit: {
        ok: (nonce, data) => ({ type: MESSAGES.didit.ok, nonce, data }),
        err: (nonce, data) => ({ type: MESSAGES.didit.err, nonce, data }),
    },
};

export const send = (socket, msg) => socket.send(JSON.stringify(msg));
