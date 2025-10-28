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
