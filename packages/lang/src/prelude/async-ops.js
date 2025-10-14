import { native } from "../natives.js";
import { Context } from "../context.js";
import { isa } from "../utils.js";
import { Block, Num, Str } from "../values.js";
import { ex, evalNext } from "../evaluator.js";
import {
    awaitTask,
    cancelTask,
    createTask,
    getAllTasks,
    getTask,
    getTaskStats,
    getTaskStatus,
} from "../async.js";

export function installAsyncOps(context) {
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
}
