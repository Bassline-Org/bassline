import { WebSocket } from "ws";
import { randomUUID } from "crypto";
import { ClientConnection, message, MESSAGES, send } from "./connections.js";

export async function initClientConnection(socket, id) {
    const { promise, resolve, reject } = Promise.withResolvers();
    socket.once("message", (msg) => {
        const { type, data } = JSON.parse(msg);
        if (type === MESSAGES.connection.ok) {
            return resolve(socket);
        }
        if (type === MESSAGES.connection.err) {
            return reject(data);
        }
        return reject(new Error(`Unknown message type: ${type} data: ${data}`));
    });
    send(socket, message.connect(id));
    return await promise;
}

export async function wsClient(url, id = randomUUID()) {
    const { promise, resolve, reject } = Promise.withResolvers();
    const socket = new WebSocket(url);
    socket.on("open", async () => {
        await initClientConnection(socket, id);
        resolve(new ClientConnection(socket));
    });

    console.log("Waiting for connection");
    const connection = await promise;
    console.log("Connection established");

    socket.on("message", (msg) => {
        const { type, nonce, data } = JSON.parse(msg);
        if (
            type === MESSAGES.didit.ok ||
            type === MESSAGES.didit.err
        ) {
            if (!nonce) return console.error("No nonce!");
            if (!data) return console.error("No data!");
            connection.didit(nonce, data, type === MESSAGES.didit.err);
        } else {
            return console.error("Unknown message type: ", type);
        }
    });
    socket.on("error", (error) => {
        connection.error("Socket error: ", error.message);
    });
    socket.on("close", () => {
        console.log("Closing client socket");
        connection.close();
    });
    return connection;
}
