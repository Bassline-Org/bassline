import file from "./file.js";
import process from "./process.js";
import { WsServer } from "./ws-server.js";
import { WsClient } from "./ws-client.js";
import { Datatype } from "../prelude/index.js";

export default {
    "ws-server!": new Datatype(WsServer),
    "ws-client!": new Datatype(WsClient),
    ...file,
    ...process,
};
