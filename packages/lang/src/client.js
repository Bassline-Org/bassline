import { WebSocket } from "ws";
import { randomUUID } from "crypto";
import { ClientConnection } from "./connections.js";

export async function wsClient(url, id = randomUUID()) {
    const socket = new WebSocket(url);
    return new ClientConnection(socket, id);
}
