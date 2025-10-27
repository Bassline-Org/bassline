import { BasslineWs } from "./server.js";

const server = new BasslineWs("0.0.0.0", 8080);
console.log("Bassline WS server running on port 8080");
