import { beforeEach, describe, expect, it } from "vitest";
import { Evaluator } from "../src/eval.js";
import { parse } from "../src/parser.js";

function run(source, setupEnv = {}) {
    const evaluator = new Evaluator();
    // Add setup values to global env
    Object.assign(evaluator.globalEnv, setupEnv);
    return evaluator.run(parse(source));
}

describe("Async Primitives", () => {
    describe("Promises as Values", () => {
        it("should keep promises as values, not auto-await them", () => {
            const source = `
                p: timeout 100
            `;

            const result = run(source);

            // Result should be a Promise, not the resolved value
            expect(result).toBeInstanceOf(Promise);
        });
    });

    describe("await primitive", () => {
        it("should unwrap a promise", async () => {
            const source = `
                p: import "./parser.js"
                mod: await p
            `;

            const result = await run(source);

            // Result should be the actual module, not a promise
            expect(typeof result).toBe("object");
            expect(typeof result.parse).toBe("function");
        });

        it("should work with inline promise", async () => {
            const source = `
                mod: await (import "./parser.js")
            `;

            const result = await run(source);

            expect(typeof result).toBe("object");
            expect(typeof result.parse).toBe("function");
        });
    });

    describe("all (Promise.all)", () => {
        it("should wait for multiple promises", async () => {
            const source = `
                p1: timeout 10
                p2: timeout 20
                p3: timeout 30

                results: await (all [p1 p2 p3])
            `;

            const result = await run(source);

            // Should return array with all results
            expect(Array.isArray(result)).toBe(true);
            expect(result.length).toBe(3);
        });

        it("should execute promises in parallel", async () => {
            const source = `
                p1: timeout 30
                p2: timeout 30
                p3: timeout 30

                await (all [p1 p2 p3])
            `;

            const start = Date.now();
            await run(source);
            const elapsed = Date.now() - start;

            // Should take ~30ms (parallel), not 90ms (sequential)
            expect(elapsed).toBeLessThan(60);
        });
    });

    describe("race (Promise.race)", () => {
        it("should return first completed promise", async () => {
            const source = `
                fast: timeout 10
                slow: timeout 100

                winner: await (race [fast slow])
            `;

            const start = Date.now();
            const result = await run(source);
            const elapsed = Date.now() - start;

            // Should complete quickly (around 10ms, not 100ms)
            expect(elapsed).toBeLessThan(50);
        });

        it("should implement timeout pattern", async () => {
            const source = `
                slow: timeout 1000
                limit: timeout 50

                result: await (race [slow limit])
            `;

            const start = Date.now();
            await run(source);
            const elapsed = Date.now() - start;

            // Should timeout quickly
            expect(elapsed).toBeLessThan(100);
        });
    });

    describe("any (Promise.any)", () => {
        it("should return first successful promise", async () => {
            const source = `
                failing: js :makeRejectingPromise "error"
                succeeding: js :makeResolvingPromise "success"

                result: await (any [failing succeeding])
            `;

            const result = await run(source, {
                makeRejectingPromise: (msg) => Promise.reject(msg),
                makeResolvingPromise: (val) =>
                    new Promise((resolve) =>
                        setTimeout(() => resolve(val), 20)
                    ),
            });

            // Should succeed (not throw)
            expect(result).toBe("success");
        });

        it("should skip failures and return first success", async () => {
            const source = `
                p1: js :makeRejectingPromise "error1"
                p2: js :makeRejectingPromise "error2"
                p3: js :makeResolvingPromise "success"

                result: await (any [p1 p2 p3])
            `;

            const result = await run(source, {
                makeRejectingPromise: (msg) => Promise.reject(msg),
                makeResolvingPromise: (val) =>
                    new Promise((resolve) =>
                        setTimeout(() => resolve(val), 30)
                    ),
            });

            // Should succeed with p3
            expect(result).toBe("success");
        });
    });

    describe("settled (Promise.allSettled)", () => {
        it("should wait for all regardless of success/failure", async () => {
            const source = `
                p1: timeout 10
                p2: js :makeRejectingPromise "error"
                p3: timeout 20

                results: await (settled [p1 p2 p3])
            `;

            const result = await run(source, {
                makeRejectingPromise: (msg) => Promise.reject(msg),
            });

            // Should return array with status objects
            expect(Array.isArray(result)).toBe(true);
            expect(result.length).toBe(3);
            expect(result[0].status).toBe("fulfilled");
            expect(result[1].status).toBe("rejected");
            expect(result[2].status).toBe("fulfilled");
        });
    });

    describe("timeout primitive", () => {
        it("should create a delay promise", async () => {
            const source = `
                await (timeout 50)
            `;

            const start = Date.now();
            await run(source);
            const elapsed = Date.now() - start;

            // Should take at least 45ms (allow some variance)
            expect(elapsed).toBeGreaterThanOrEqual(45);
        });

        it("should return undefined after delay", async () => {
            const source = `
                result: await (timeout 10)
            `;

            const result = await run(source);

            expect(result).toBeUndefined();
        });
    });

    describe("background (fire and forget)", () => {
        it("should run without blocking", async () => {
            const source = `
                background [
                    await (timeout 100)
                ]

                result: "immediate"
            `;

            const start = Date.now();
            const result = await run(source);
            const elapsed = Date.now() - start;

            // Should return immediately (not wait 100ms)
            expect(result).toBe("immediate");
            expect(elapsed).toBeLessThan(50);
        });
    });

    describe("Complex async patterns", () => {
        it("should support fallback pattern with any", async () => {
            const source = `
                primary: js :makeRejectingPromise "primary failed"
                backup: js :makeRejectingPromise "backup failed"
                fallback: js :makeResolvingPromise "fallback-data"

                data: await (any [primary backup fallback])
            `;

            const result = await run(source, {
                makeRejectingPromise: (msg) => Promise.reject(msg),
                makeResolvingPromise: (val) =>
                    new Promise((resolve) =>
                        setTimeout(() => resolve(val), 20)
                    ),
            });

            // Should succeed with fallback
            expect(result).toBe("fallback-data");
        });

        it("should support parallel + race combination", async () => {
            const source = `
                p1: timeout 20
                p2: timeout 25
                p3: timeout 30

                ops: all [p1 p2 p3]
                limit: timeout 100

                result: await (race [ops limit])
            `;

            const start = Date.now();
            const result = await run(source);
            const elapsed = Date.now() - start;

            // Should complete when all ops finish (~30ms)
            expect(elapsed).toBeLessThan(60);
            expect(Array.isArray(result)).toBe(true);
        });
    });
});
