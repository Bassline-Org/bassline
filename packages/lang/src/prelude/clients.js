import { wsClient } from "../client.js";
import { createRuntime } from "../runtime.js";
import { litWord, nativeFn, number, task } from "./datatypes/index.js";
import { ContextBase } from "./index.js";
import { normalize } from "../utils.js";

const client = normalize("client!");
export class Client extends ContextBase.typed(client) {
    constructor(clientPromise) {
        super();
        this.clientPromise = Promise.resolve(clientPromise);
        this.clientPromise.then((client) => {
            this.client = client;
            this.set("status", litWord("connected"));
            this.client.socket.on("close", () => {
                this.set("status", litWord("disconnected"));
            });
        });
    }
    nonce() {
        return number(this.client ? this.client.nonce : -1);
    }

    doBlock(block) {
        return task(this.clientPromise.then(async (client) => {
            const exprs = block.items.map((expr) => expr.mold());
            const result = await client.doit(exprs.join(" "));
            console.log("RESULT: ", result);
            return result;
        }));
    }
}

const supportedSchemes = {
    WS: wsClient,
};

export function connect(uri, data) {
    const scheme = uri.get("scheme").value;
    const host = uri.get("host").value;
    const port = uri.get("port").value;
    const createClient = supportedSchemes[scheme];
    if (!createClient) {
        throw new Error(`Unsupported scheme: ${scheme.value}`);
    }
    return createClient(`${scheme}://${host}:${port}`, data);
}

const rt = createRuntime();

rt.context.set(
    "connect",
    nativeFn("uri data", (uri, data) => {
        const clientPromise = connect(uri, data);
        return new Client(clientPromise);
    }),
);
rt.context.set(
    "nonce",
    nativeFn("client", (client) => {
        return number(client.client ? client.client.nonce : -1);
    }),
);

rt.evaluate(`
    uri: ws://127.0.0.1:8080
    id: "running-client"
    client: connect uri reduce [id]

    in client [print "hello"]
    words-in-remote: in client [ print keys self ]
    after (sleep 1000) [ print nonce client ] system
    `);
