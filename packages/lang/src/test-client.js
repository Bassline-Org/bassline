import { randomUUID } from "crypto";
import { wsClient } from "./client.js";

let updateCount = 0;
const clientCount = 5000;

const client = async (id) =>
    await wsClient(
        "ws://localhost:8080",
        id,
    );

const clients = [];
for (let i = 0; i < clientCount; i++) {
    const key = randomUUID();
    const c = await client(key);
    clients.push(c);
}

let now = Date.now();
await Promise.all(clients.map(async (c) => {
    const updates = Math.floor(Math.random() * 100) + 1;
    let changes = "";
    for (let j = 0; j < updates; j++) {
        changes += ` foo: ${j} `;
        updateCount++;
    }
    await c.doit(changes);
}));

await Promise.all(clients.map((c) => c.close()));
const end = Date.now();

await new Promise((resolve) => setTimeout(resolve, 1000));
console.log(
    `Time taken: ${end - now}ms, ${updateCount / (end - now)} updates/ms`,
);
console.log(`Updated ${updateCount} times over ${clientCount} clients`);
