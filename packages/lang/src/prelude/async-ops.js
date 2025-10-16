import { native } from "../datatypes/functions.js";
import { Context } from "../datatypes/context.js";
import { isa } from "../utils.js";
import { Block } from "../datatypes/core.js";
import { evalNext, ex } from "../evaluator.js";

export function installAsyncOps(context) {
    const asyncTasksContext = new Context();
    context.set("ASYNC_TASKS", asyncTasksContext);

    // async [block]
    // Execute block asynchronously, return task handle immediately
    context.set(
        "async",
        native(async (stream, context) => {
            const block = await evalNext(stream, context);

            if (!isa(block, Block)) {
                throw new Error("async expects a block");
            }
            const id = crypto.randomUUID();
            const taskContext = new Context(context);
            asyncTasksContext.set(id, taskContext);
            taskContext.set("id", id);
            taskContext.set("status", "pending");
            taskContext.set("startTime", Date.now());
            taskContext.set(
                "promise",
                Promise.resolve(ex(context, block)).then((result) => {
                    taskContext.set("result", result);
                    taskContext.set("status", "complete");
                    taskContext.set("endTime", Date.now());
                    taskContext.set(
                        "duration",
                        Date.now() - taskContext.get("startTime"),
                    );
                    return result;
                }),
            );
            return taskContext;
        }),
    );

    // await <task-handle>
    // Wait for task to complete and return result
    context.set(
        "await",
        native(async (stream, context) => {
            const taskContext = await evalNext(stream, context);

            if (!isa(taskContext, Context)) {
                throw new Error("await expects a task context");
            }

            // Wait for task to complete
            const result = await taskContext.get("promise");

            return await result;
        }),
    );

    // sleep <ms>
    // Sleep for the given number of milliseconds
    context.set(
        "sleep",
        native(async (stream, context) => {
            const ms = await evalNext(stream, context);
            return await new Promise((resolve) => setTimeout(resolve, ms));
        }),
    );

    // status <task-handle>
    // Get task status: "pending" | "complete" | "error" | "not-found"
    context.set(
        "status",
        native(async (stream, context) => {
            const taskContext = await evalNext(stream, context);

            if (!isa(taskContext, Context)) {
                throw new Error("status expects a task context");
            }

            return taskContext.get("status");
        }),
    );
}
