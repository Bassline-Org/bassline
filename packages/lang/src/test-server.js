import { BasslineWs } from "./server.js";

const server = new BasslineWs("0.0.0.0", 8080);
console.log("Bassline WS server running on port 8080");

setInterval(() => {
    console.log("Connections: ", server.connections.size);
    console.log("Runtimes: ", server.runtimes.size);
}, 1000);
