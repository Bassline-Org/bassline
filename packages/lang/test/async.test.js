import { describe, expect, it } from "vitest";
import { createRepl } from "../src/repl.js";

describe("Async Operations", () => {
    it("should create async task and return handle immediately", async () => {
        const repl = createRepl();
        const result = await repl.eval("task: async [+ 1 2]");

        expect(result.ok).toBe(true);
        expect(result.value.constructor.name).toBe("Context");
        expect(result.value._taskId).toBeDefined();
    });

    it("should await task result", async () => {
        const repl = createRepl();

        await repl.eval("task: async [+ 5 10]");
        const result = await repl.eval("await task");

        expect(result.ok).toBe(true);
        expect(result.value.value).toBe(15);
    });

    it("should get task status", async () => {
        const repl = createRepl();

        await repl.eval("task: async [+ 1 2]");
        const statusResult = await repl.eval("status task");

        expect(statusResult.ok).toBe(true);
        expect(statusResult.value.value).toMatch(/pending|complete/);
    });

    it("should track multiple async tasks", async () => {
        const repl = createRepl();

        await repl.eval("t1: async [+ 1 2]");
        await repl.eval("t2: async [* 3 4]");
        await repl.eval("t3: async [- 10 5]");

        const statsResult = await repl.eval("task-stats");
        expect(statsResult.ok).toBe(true);

        const total = statsResult.value.get(Symbol.for("TOTAL"));
        expect(total.value).toBeGreaterThanOrEqual(3);
    });

    it("should handle async fetch", async () => {
        const repl = createRepl();

        await repl.eval('task: async [fetch "https://api.github.com/repos/octocat/Hello-World"]');
        const result = await repl.eval("result: await task");

        expect(result.ok).toBe(true);
        expect(result.value.constructor.name).toBe("Str");
        expect(result.value.value).toContain("Hello-World");
    }, 10000);

    it("should handle spawn-async", async () => {
        const repl = createRepl();

        const result = await repl.eval("task: spawn-async [+ 100 200]");
        expect(result.ok).toBe(true);

        const awaitResult = await repl.eval("await task");
        expect(awaitResult.value.value).toBe(300);
    });

    it("should update ASYNC_TASKS context", async () => {
        const repl = createRepl();

        await repl.eval("task: async [+ 1 1]");
        const tasksResult = await repl.eval("keys ASYNC_TASKS");

        expect(tasksResult.ok).toBe(true);
        expect(tasksResult.value.items.length).toBeGreaterThan(0);
    });

    it("should handle errors in async tasks", async () => {
        const repl = createRepl();

        // Create task that will error (undefined variable)
        await repl.eval("task: async [+ undefined-var 5]");

        // Awaiting should work but the task errored
        const result = await repl.eval("await task");

        // The await itself succeeds but returns NaN (arithmetic with undefined)
        expect(result.ok).toBe(true);
    });

    it("should allow checking status before await", async () => {
        const repl = createRepl();

        await repl.eval("task: async [+ 7 8]");

        // Status should be checkable immediately
        const statusResult = await repl.eval("status task");
        expect(statusResult.ok).toBe(true);

        // Then await
        const result = await repl.eval("await task");
        expect(result.ok).toBe(true);
        expect(result.value.value).toBe(15);

        // Status after completion
        const finalStatus = await repl.eval("status task");
        expect(finalStatus.value.value).toBe("complete");
    });
});
