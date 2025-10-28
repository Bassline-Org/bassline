import { wsClient } from "./client.js";
import { randomUUID } from "crypto";

let updateCount = 0;
let now = Date.now();
const clientCount = 10000;
let clients = [];
let batch = [];
for (let i = 1; i <= clientCount; i++) {
    const client = await wsClient("ws://localhost:8080", randomUUID());
    clients.push(client);
    batch.push(client);
    if (i % 1000 === 0) {
        await Promise.all(batch.map(async (client) => {
            await client.doit(`foo: ${Date.now()}`);
            await client.doit("print foo");
            await client.doit("foo: 69");
            await client.doit("print foo");
            updateCount += 4;
        }));
        batch = [];
    }
}

const end = Date.now();
console.log(
    `Time taken: ${end - now}ms, ${updateCount / (end - now) * 1000} ops/sec`,
);

clients.forEach((client) => {
    client.close();
});
