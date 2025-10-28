import { wsClient } from "./client.js";

const client = async (id) =>
    await wsClient(
        "ws://localhost:8080",
        id,
    );

const a = await client("a");
await a.req("foo: 123");
await a.req("foo");
await a.close();

const otherA = await client("a");
await otherA.req("foo");
await otherA.req("foo: 456");
await otherA.req("foo");
await otherA.req("detach");
