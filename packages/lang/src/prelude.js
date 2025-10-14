import { Context } from "./context.js";

// Import evaluator functions
export { callFunction, evalNext, ex } from "./evaluator.js";

// Import all standard library modules
import { installArithmetic } from "./prelude/arithmetic.js";
import { installComparison } from "./prelude/comparison.js";
import { installControlFlow } from "./prelude/control-flow.js";
import { installSeries } from "./prelude/series.js";
import { installContextOps } from "./prelude/context-ops.js";
import { installFunctions } from "./prelude/functions.js";
import { installTypes } from "./prelude/types.js";
import { installStrings } from "./prelude/strings.js";
import { installHttp } from "./prelude/http.js";
import { installJson } from "./prelude/json.js";
import { installReflection } from "./prelude/reflection.js";
import { installView } from "./prelude/view.js";
import { installGadgets } from "./prelude/gadgets.js";
import { installDialects } from "./prelude/dialects.js";

// Import async/contact/remote operations (these will be added back later)
import { evalValue, native } from "./natives.js";
import { isa } from "./utils.js";
import { Block, Num, Str } from "./values.js";
import { evalNext, ex } from "./evaluator.js";
import {
    awaitTask,
    cancelTask,
    createTask,
    getAllTasks,
    getTask,
    getTaskStats,
    getTaskStatus,
} from "./async.js";
import {
    createContact,
    describeContact,
    deserializeContact,
    hasCapability,
    serializeContact,
} from "./contact.js";

// Create a prelude context with built-in natives
export function createPreludeContext() {
    const context = new Context();

    // Install all standard library modules
    installDialects(context);
    installGadgets(context);
    installArithmetic(context);
    installComparison(context);
    installControlFlow(context);
    installSeries(context);
    installContextOps(context);
    installFunctions(context);
    installTypes(context);
    installReflection(context);
    installView(context);
    installStrings(context);
    installHttp(context);
    installJson(context);

    // --- Async Operations --- (TODO: Extract to prelude/async.js)

    // Create ASYNC_TASKS global context
    const asyncTasksContext = new Context();
    context.set("ASYNC_TASKS", asyncTasksContext);

    // Helper to update ASYNC_TASKS context with current tasks
    function updateAsyncTasksContext() {
        const tasks = getAllTasks();
        tasks.forEach((task) => {
            const taskContext = new Context();
            taskContext.set("id", new Str(task.id));
            taskContext.set("name", new Str(task.name));
            taskContext.set("status", new Str(task.status));
            taskContext.set("startTime", new Num(task.startTime));
            if (task.endTime) {
                taskContext.set("endTime", new Num(task.endTime));
                taskContext.set(
                    "duration",
                    new Num(task.endTime - task.startTime),
                );
            }
            asyncTasksContext.set(task.id, taskContext);
        });
    }

    // async [block]
    // Execute block asynchronously, return task handle immediately
    context.set(
        "async",
        native(async (stream, context) => {
            const block = stream.next();

            if (!isa(block, Block)) {
                throw new Error("async expects a block");
            }

            // Create task that executes the block
            const task = createTask(async () => {
                return await ex(context, block);
            }, { name: "async block" });

            // Update ASYNC_TASKS context
            updateAsyncTasksContext();

            // Return task handle as a context
            const taskHandle = new Context();
            taskHandle.set("id", new Str(task.id));
            taskHandle.set("type", new Str("task"));
            taskHandle._taskId = task.id; // Store internal reference
            return taskHandle;
        }),
    );

    // spawn-async [block]
    // Alias for async (same behavior)
    context.set(
        "spawn-async",
        native(async (stream, context) => {
            const block = stream.next();

            if (!isa(block, Block)) {
                throw new Error("spawn-async expects a block");
            }

            const task = createTask(async () => {
                return await ex(context, block);
            }, { name: "spawn-async block" });

            updateAsyncTasksContext();

            const taskHandle = new Context();
            taskHandle.set("id", new Str(task.id));
            taskHandle.set("type", new Str("task"));
            taskHandle._taskId = task.id;
            return taskHandle;
        }),
    );

    // await <task-handle>
    // Wait for task to complete and return result
    context.set(
        "await",
        native(async (stream, context) => {
            const taskHandle = await evalNext(stream, context);

            // Extract task ID from handle
            let taskId;
            if (taskHandle instanceof Context && taskHandle._taskId) {
                taskId = taskHandle._taskId;
            } else if (isa(taskHandle, Str)) {
                taskId = taskHandle.value;
            } else {
                throw new Error("await expects a task handle or task ID");
            }

            const task = getTask(taskId);
            if (!task) {
                throw new Error(`Task not found: ${taskId}`);
            }

            // Wait for task to complete
            const result = await awaitTask(task);

            // Update context
            updateAsyncTasksContext();

            return result;
        }),
    );

    // status <task-handle>
    // Get task status: "pending" | "complete" | "error" | "not-found"
    context.set(
        "status",
        native(async (stream, context) => {
            const taskHandle = await evalNext(stream, context);

            let taskId;
            if (taskHandle instanceof Context && taskHandle._taskId) {
                taskId = taskHandle._taskId;
            } else if (isa(taskHandle, Str)) {
                taskId = taskHandle.value;
            } else {
                throw new Error("status expects a task handle or task ID");
            }

            const status = getTaskStatus(taskId);
            return new Str(status);
        }),
    );

    // cancel <task-handle>
    // Cancel a running task (best effort)
    context.set(
        "cancel",
        native(async (stream, context) => {
            const taskHandle = await evalNext(stream, context);

            let taskId;
            if (taskHandle instanceof Context && taskHandle._taskId) {
                taskId = taskHandle._taskId;
            } else if (isa(taskHandle, Str)) {
                taskId = taskHandle.value;
            } else {
                throw new Error("cancel expects a task handle or task ID");
            }

            const cancelled = cancelTask(taskId);
            updateAsyncTasksContext();
            return cancelled;
        }),
    );

    // task-stats
    // Get statistics about async tasks
    context.set(
        "task-stats",
        native(async () => {
            const stats = getTaskStats();
            const statsContext = new Context();
            statsContext.set("total", new Num(stats.total));
            statsContext.set("pending", new Num(stats.pending));
            statsContext.set("complete", new Num(stats.complete));
            statsContext.set("error", new Num(stats.error));
            statsContext.set("cancelled", new Num(stats.cancelled || 0));
            return statsContext;
        }),
    );

    // --- Contact Protocol --- (TODO: Extract to prelude/contacts.js)

    // Create runtime contact automatically
    const runtimeContact = createContact(
        typeof window !== "undefined" ? "Browser REPL" : "Bassline Runtime",
        [], // No endpoints yet
        {},
    );

    // Helper to convert contact to Bassline Context
    function contactToContext(contact) {
        const contactContext = new Context();
        contactContext.set("id", new Str(contact.id));
        contactContext.set("name", new Str(contact.name));

        // Endpoints as block of strings
        const endpointsBlock = new Block(
            contact.endpoints.map((e) => new Str(e)),
        );
        contactContext.set("endpoints", endpointsBlock);

        // Capabilities as block of strings
        const capabilitiesBlock = new Block(
            contact.capabilities.map((c) => new Str(c)),
        );
        contactContext.set("capabilities", capabilitiesBlock);

        contactContext.set("timestamp", new Num(contact.timestamp));

        // Store internal reference
        contactContext._contact = contact;

        return contactContext;
    }

    // Helper to extract contact from Context
    function contextToContact(ctx) {
        if (ctx._contact) {
            return ctx._contact;
        }

        // Extract from context
        const id = ctx.get(Symbol.for("ID"));
        const name = ctx.get(Symbol.for("NAME"));
        const endpoints = ctx.get(Symbol.for("ENDPOINTS"));
        const capabilities = ctx.get(Symbol.for("CAPABILITIES"));

        return {
            id: isa(id, Str) ? id.value : String(id),
            name: isa(name, Str) ? name.value : String(name),
            endpoints: endpoints && isa(endpoints, Block)
                ? endpoints.items.map((e) => isa(e, Str) ? e.value : String(e))
                : [],
            capabilities: capabilities && isa(capabilities, Block)
                ? capabilities.items.map((c) =>
                    isa(c, Str) ? c.value : String(c)
                )
                : [],
            timestamp: Date.now(),
        };
    }

    // RUNTIME_CONTACT - global contact for this runtime
    context.set("RUNTIME_CONTACT", contactToContext(runtimeContact));

    // make-contact <name> <endpoints-block>
    // Create a new contact
    context.set(
        "make-contact",
        native(async (stream, context) => {
            const name = evalValue(stream.next(), context);
            const endpoints = await evalNext(stream, context);

            const nameStr = isa(name, Str) ? name.value : String(name);

            let endpointsArray = [];
            if (isa(endpoints, Block)) {
                endpointsArray = endpoints.items.map((e) =>
                    isa(e, Str) ? e.value : String(e)
                );
            }

            const contact = createContact(nameStr, endpointsArray);
            return contactToContext(contact);
        }),
    );

    // parse-contact <json-str>
    // Deserialize contact from JSON string
    context.set(
        "parse-contact",
        native(async (stream, context) => {
            const jsonStr = evalValue(stream.next(), context);
            const json = isa(jsonStr, Str) ? jsonStr.value : String(jsonStr);

            try {
                const contact = deserializeContact(json);
                return contactToContext(contact);
            } catch (error) {
                throw new Error(`parse-contact failed: ${error.message}`);
            }
        }),
    );

    // to-contact-json <contact>
    // Serialize contact to JSON string
    context.set(
        "to-contact-json",
        native(async (stream, context) => {
            const contactCtx = await evalNext(stream, context);

            if (!(contactCtx instanceof Context)) {
                throw new Error("to-contact-json expects a contact context");
            }

            const contact = contextToContact(contactCtx);
            const json = serializeContact(contact);
            return new Str(json);
        }),
    );

    // contact-has? <contact> <capability>
    // Check if contact has a capability
    context.set(
        "contact-has?",
        native(async (stream, context) => {
            const contactCtx = await evalNext(stream, context);
            const capability = evalValue(stream.next(), context);

            if (!(contactCtx instanceof Context)) {
                throw new Error("contact-has? expects a contact context");
            }

            const contact = contextToContact(contactCtx);
            const capStr = isa(capability, Str)
                ? capability.value
                : String(capability);
            return hasCapability(contact, capStr);
        }),
    );

    // describe-contact <contact>
    // Get human-readable description of contact
    context.set(
        "describe-contact",
        native(async (stream, context) => {
            const contactCtx = await evalNext(stream, context);

            if (!(contactCtx instanceof Context)) {
                throw new Error("describe-contact expects a contact context");
            }

            const contact = contextToContact(contactCtx);
            const description = describeContact(contact);
            return new Str(description);
        }),
    );

    // --- Remote Operations --- (TODO: Extract to prelude/remote.js - keeping inline for now)

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
            const { Word: WordValue } = await import("./values.js");
            const command = stream.next();

            if (!isa(command, WordValue)) {
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
                    "./transports/websocket-client.js"
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
                        if (isa(item, WordValue)) {
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

    // Special values
    context.set("true", true);
    context.set("false", false);
    context.set("none", null);

    // system - reference to the prelude context itself
    context.set("system", context);

    return context;
}
