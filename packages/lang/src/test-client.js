import { BasslineWsClient } from "./client.js";

const client = new BasslineWsClient(
    "ws://localhost:8080",
    'print "hello world"',
);
console.log("Bassline WS client connected to server");
