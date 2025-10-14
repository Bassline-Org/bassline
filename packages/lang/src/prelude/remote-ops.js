import { native } from "../natives.js";
import { Context } from "../context.js";
import { isa } from "../utils.js";
import { Block, Num, Str, Word } from "../values.js";
import { evalNext } from "../evaluator.js";
import { createTask } from "../async.js";

export function installRemoteOps(context, updateAsyncTasksContext) {
    // Create REMOTE_PEERS global context
    const remotePeersContext = new Context();
    context.set("REMOTE_PEERS", remotePeersContext);

    // Helper to deserialize RPC response value
    function deserializeRPCValue(value) {
        if (!value || typeof value !== "object") {
            return value;
        }

        if (value.type === "num") {
            return new Num(value.value);
        }
        if (value.type === "str") {
            return new Str(value.value);
        }
        if (value.type === "block") {
            return new Block(value.items.map(deserializeRPCValue));
        }
        if (value.type === "context") {
            const ctx = new Context();
            for (const [key, val] of Object.entries(value.bindings)) {
                ctx.set(key, deserializeRPCValue(val));
            }
            return ctx;
        }

        return value;
    }

    // remote connect <url-or-contact>
    // Connect to a remote Bassline runtime
    context.set(
        "remote",
        native(async (stream, context) => {
            const command = stream.next();

            if (!isa(command, Word)) {
                throw new Error(
                    "remote expects a command (connect, exec, disconnect)",
                );
            }

            const commandStr = command.spelling.description.toLowerCase();

            if (commandStr === "connect") {
                const urlOrContact = await evalNext(stream, context);

                let url;
                if (isa(urlOrContact, Str)) {
                    url = urlOrContact.value;
                } else if (urlOrContact instanceof Context) {
                    // Extract URL from contact endpoints
                    const endpoints = urlOrContact.get(Symbol.for("ENDPOINTS"));
                    if (
                        endpoints && isa(endpoints, Block) &&
                        endpoints.items.length > 0
                    ) {
                        url = endpoints.items[0].value;
                    } else {
                        throw new Error("Contact has no endpoints");
                    }
                } else {
                    throw new Error(
                        "remote connect expects a URL string or contact",
                    );
                }

                // Only available in browser
                if (typeof WebSocket === "undefined") {
                    throw new Error(
                        "WebSocket not available in this environment",
                    );
                }

                // Import WebSocket client dynamically
                const { createRPCClient } = await import(
                    "../transports/websocket-client.js"
                );

                // Create connection
                const rpcClient = createRPCClient(url, {
                    maxReconnectAttempts: 3,
                });

                // Connect
                return new Promise((resolve, reject) => {
                    const timeout = setTimeout(() => {
                        reject(new Error("Connection timeout"));
                    }, 5000);

                    rpcClient.on("open", () => {
                        clearTimeout(timeout);

                        // Create peer handle
                        const peerHandle = new Context();
                        peerHandle.set("url", new Str(url));
                        peerHandle.set("status", new Str("connected"));
                        peerHandle.set("connected-at", new Num(Date.now()));
                        peerHandle._rpcClient = rpcClient;

                        // Store in REMOTE_PEERS
                        remotePeersContext.set(url, peerHandle);

                        resolve(peerHandle);
                    });

                    rpcClient.on("error", (error) => {
                        clearTimeout(timeout);
                        reject(error);
                    });

                    rpcClient.connect();
                });
            } else if (commandStr === "exec") {
                const peerHandle = await evalNext(stream, context);
                const codeBlock = stream.next();

                if (
                    !(peerHandle instanceof Context) || !peerHandle._rpcClient
                ) {
                    throw new Error(
                        "remote exec expects a peer handle from remote connect",
                    );
                }

                if (!isa(codeBlock, Block)) {
                    throw new Error("remote exec expects a code block");
                }

                // Serialize the code block to Bassline code string
                const code = codeBlock.items
                    .map((item) => {
                        if (isa(item, Num)) return String(item.value);
                        if (isa(item, Str)) return `"${item.value}"`;
                        if (isa(item, Word)) {
                            return item.spelling.description;
                        }
                        return String(item);
                    })
                    .join(" ");

                // Execute on remote via RPC
                const task = createTask(async () => {
                    const result = await peerHandle._rpcClient.call("eval", {
                        code,
                    });

                    if (!result.ok) {
                        throw new Error(
                            result.error || "Remote execution failed",
                        );
                    }

                    return deserializeRPCValue(result.value);
                }, { name: `remote exec: ${code.substring(0, 50)}...` });

                updateAsyncTasksContext();

                // Return task handle
                const taskHandle = new Context();
                taskHandle.set("id", new Str(task.id));
                taskHandle.set("type", new Str("task"));
                taskHandle._taskId = task.id;
                return taskHandle;
            } else if (commandStr === "disconnect") {
                const peerHandle = await evalNext(stream, context);

                if (
                    !(peerHandle instanceof Context) || !peerHandle._rpcClient
                ) {
                    throw new Error("remote disconnect expects a peer handle");
                }

                peerHandle._rpcClient.disconnect();

                // Update status
                peerHandle.set("status", new Str("disconnected"));

                return true;
            } else {
                throw new Error(`Unknown remote command: ${commandStr}`);
            }
        }),
    );
}
