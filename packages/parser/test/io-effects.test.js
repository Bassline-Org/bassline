import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { WatchedGraph } from "../src/algebra/watch.js";
import {
    getActiveEffects,
    getHandledContexts,
    getInput,
    getOutput,
    installBuiltinEffects,
    installIOEffect,
    isHandled,
    isProcessing,
} from "../extensions/io-effects.js";
import { matchGraph, pattern, patternQuad } from "../src/algebra/pattern.js";
import { quad as q } from "../src/algebra/quad.js";
import { variable as v, word as w } from "../src/types.js";

// Helper to wait for async effects to complete
async function waitForEffect(graph, effectName, ctx, timeout = 1000) {
    const start = Date.now();
    while (!isHandled(graph, effectName, ctx)) {
        if (Date.now() - start > timeout) {
            throw new Error(`Timeout waiting for ${effectName.spelling?.description || effectName} to handle ${ctx.spelling?.description || ctx}`);
        }
        await new Promise(resolve => setTimeout(resolve, 10));
    }
}

describe("IO-Effects", () => {
    describe("Browser Effects - Console", () => {
        let consoleLogSpy;
        let consoleErrorSpy;
        let consoleWarnSpy;

        beforeEach(() => {
            consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
            consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        });

        afterEach(() => {
            consoleLogSpy.mockRestore();
            consoleErrorSpy.mockRestore();
            consoleWarnSpy.mockRestore();
        });

        describe("LOG", () => {
            it("should log message to console", async () => {
                const g = new WatchedGraph();
                installBuiltinEffects(g);

                g.add(q(w("req1"), w("MESSAGE"), "Hello World", w("req1")));
                g.add(q(w("req1"), w("handle"), w("LOG"), w("input")));

                await waitForEffect(g, w("LOG"), w("req1"));

                expect(consoleLogSpy).toHaveBeenCalledWith("Hello World");
                expect(isHandled(g, w("LOG"), w("req1"))).toBe(true);
            });

            it("should write LOGGED output", async () => {
                const g = new WatchedGraph();
                installBuiltinEffects(g);

                g.add(q(w("req1"), w("MESSAGE"), "Test", w("req1")));
                g.add(q(w("req1"), w("handle"), w("LOG"), w("input")));

                await waitForEffect(g, w("LOG"), w("req1"));

                expect(getOutput(g, w("req1"), w("LOGGED"))).toBe("TRUE");
                expect(getOutput(g, w("req1"), w("MESSAGE"))).toBe("Test");
            });

            it("should write SUCCESS status", async () => {
                const g = new WatchedGraph();
                installBuiltinEffects(g);

                g.add(q(w("req1"), w("MESSAGE"), "Test", w("req1")));
                g.add(q(w("req1"), w("handle"), w("LOG"), w("input")));

                await waitForEffect(g, w("LOG"), w("req1"));

                const status = getOutput(g, w("req1"), w("status"));
                expect(status.spelling).toBe(w("SUCCESS").spelling);
            });
        });

        describe("ERROR", () => {
            it("should log error message to console", async () => {
                const g = new WatchedGraph();
                installBuiltinEffects(g);

                g.add(q(w("req1"), w("MESSAGE"), "Error occurred", w("req1")));
                g.add(q(w("req1"), w("handle"), w("ERROR"), w("input")));

                await waitForEffect(g, w("ERROR"), w("req1"));

                expect(consoleErrorSpy).toHaveBeenCalledWith("Error occurred");
            });

            it("should write outputs correctly", async () => {
                const g = new WatchedGraph();
                installBuiltinEffects(g);

                g.add(q(w("req1"), w("MESSAGE"), "Bad things", w("req1")));
                g.add(q(w("req1"), w("handle"), w("ERROR"), w("input")));

                await waitForEffect(g, w("ERROR"), w("req1"));

                expect(getOutput(g, w("req1"), w("LOGGED"))).toBe("TRUE");
            });
        });

        describe("WARN", () => {
            it("should log warning message to console", async () => {
                const g = new WatchedGraph();
                installBuiltinEffects(g);

                g.add(q(w("req1"), w("MESSAGE"), "Warning message", w("req1")));
                g.add(q(w("req1"), w("handle"), w("WARN"), w("input")));

                await waitForEffect(g, w("WARN"), w("req1"));

                expect(consoleWarnSpy).toHaveBeenCalledWith("Warning message");
            });
        });
    });

    describe("Helper Functions", () => {
        it("getInput should extract input value from context", () => {
            const g = new WatchedGraph();

            g.add(q(w("req1"), w("MESSAGE"), "Hello", w("req1")));
            g.add(q(w("req1"), w("URL"), "http://example.com", w("req1")));

            expect(getInput(g, w("req1"), "MESSAGE")).toBe("Hello");
            expect(getInput(g, w("req1"), "URL")).toBe("http://example.com");
        });

        it("getInput should return undefined for missing input", () => {
            const g = new WatchedGraph();

            expect(getInput(g, w("req1"), "MESSAGE")).toBeUndefined();
        });

        it("getOutput should extract output value from context", async () => {
            const g = new WatchedGraph();
            installBuiltinEffects(g);

            g.add(q(w("req1"), w("MESSAGE"), "Test", w("req1")));
            g.add(q(w("req1"), w("handle"), w("LOG"), w("input")));

            await waitForEffect(g, w("LOG"), w("req1"));

            expect(getOutput(g, w("req1"), w("LOGGED"))).toBe("TRUE");
        });

        it("isHandled should check if effect completed", async () => {
            const g = new WatchedGraph();
            installBuiltinEffects(g);

            g.add(q(w("req1"), w("MESSAGE"), "Test", w("req1")));

            expect(isHandled(g, w("LOG"), w("req1"))).toBe(false);

            g.add(q(w("req1"), w("handle"), w("LOG"), w("input")));

            await waitForEffect(g, w("LOG"), w("req1"));

            expect(isHandled(g, w("LOG"), w("req1"))).toBe(true);
        });

        it("isProcessing should check if effect is processing", () => {
            const g = new WatchedGraph();
            installBuiltinEffects(g);

            g.add(q(w("req1"), w("MESSAGE"), "Test", w("req1")));

            expect(isProcessing(g, w("LOG"), w("req1"))).toBe(false);

            g.add(q(w("req1"), w("handle"), w("LOG"), w("input")));

            // Should be processing immediately after trigger
            expect(isProcessing(g, w("LOG"), w("req1"))).toBe(true);
        });

        it("getHandledContexts should find all handled contexts", async () => {
            const g = new WatchedGraph();
            installBuiltinEffects(g);

            g.add(q(w("req1"), w("MESSAGE"), "Test1", w("req1")));
            g.add(q(w("req1"), w("handle"), w("LOG"), w("input")));

            g.add(q(w("req2"), w("MESSAGE"), "Test2", w("req2")));
            g.add(q(w("req2"), w("handle"), w("LOG"), w("input")));

            await waitForEffect(g, w("LOG"), w("req1"));
            await waitForEffect(g, w("LOG"), w("req2"));

            const contexts = getHandledContexts(g, w("LOG"));
            expect(contexts).toHaveLength(2);

            const spellings = contexts.map((c) => c.spelling);
            expect(spellings).toContain(w("req1").spelling);
            expect(spellings).toContain(w("req2").spelling);
        });

        it("getActiveEffects should list installed effects", () => {
            const g = new WatchedGraph();
            installBuiltinEffects(g);

            const effects = getActiveEffects(g);

            // Should have at least LOG, ERROR, WARN
            expect(effects.length).toBeGreaterThanOrEqual(3);

            const effectNames = effects.map((e) => e.spelling);
            expect(effectNames).toContain(w("LOG").spelling);
            expect(effectNames).toContain(w("ERROR").spelling);
            expect(effectNames).toContain(w("WARN").spelling);
        });
    });

    describe("Error Handling", () => {
        it("should handle executor errors gracefully", async () => {
            const g = new WatchedGraph();

            // Install effect that throws
            installIOEffect(
                g,
                "THROWS",
                async (graph, ctx) => {
                    throw new Error("Test error");
                },
                {
                    category: "test",
                    doc: "Test effect that throws"
                }
            );

            g.add(q(w("req1"), w("handle"), w("THROWS"), w("input")));

            await waitForEffect(g, w("THROWS"), w("req1"));

            // Should have error in output
            const error = getOutput(g, w("req1"), w("error"));
            expect(error).toBe("Test error");

            // Status should be error
            const status = getOutput(g, w("req1"), w("status"));
            expect(status.spelling).toBe(w("error").spelling);

            // Should still be marked as handled
            expect(isHandled(g, w("THROWS"), w("req1"))).toBe(true);
        });

        it("should handle missing inputs in custom effects", async () => {
            const g = new WatchedGraph();

            installIOEffect(
                g,
                "NEEDS_INPUT",
                async (graph, ctx) => {
                    const required = getInput(graph, ctx, "REQUIRED");
                    if (!required) {
                        throw new Error("REQUIRED input missing");
                    }
                    return { RESULT: "OK" };
                },
                { category: "test" }
            );

            g.add(q(w("req1"), w("handle"), w("NEEDS_INPUT"), w("input")));

            await waitForEffect(g, w("NEEDS_INPUT"), w("req1"));

            const error = getOutput(g, w("req1"), w("error"));
            expect(error).toContain("REQUIRED input missing");
        });
    });

    describe("Multiple Effects", () => {
        it("should handle same effect on different contexts independently", async () => {
            const g = new WatchedGraph();
            installBuiltinEffects(g);

            g.add(q(w("req1"), w("MESSAGE"), "Message 1", w("req1")));
            g.add(q(w("req1"), w("handle"), w("LOG"), w("input")));

            g.add(q(w("req2"), w("MESSAGE"), "Message 2", w("req2")));
            g.add(q(w("req2"), w("handle"), w("LOG"), w("input")));

            await waitForEffect(g, w("LOG"), w("req1"));
            await waitForEffect(g, w("LOG"), w("req2"));

            expect(getOutput(g, w("req1"), w("MESSAGE"))).toBe("Message 1");
            expect(getOutput(g, w("req2"), w("MESSAGE"))).toBe("Message 2");
        });

        it("should handle different effects on same context", async () => {
            const g = new WatchedGraph();
            installBuiltinEffects(g);

            g.add(q(w("req1"), w("MESSAGE"), "Test", w("req1")));
            g.add(q(w("req1"), w("handle"), w("LOG"), w("input")));

            await waitForEffect(g, w("LOG"), w("req1"));

            g.add(q(w("req1"), w("handle"), w("WARN"), w("input")));

            await waitForEffect(g, w("WARN"), w("req1"));

            expect(isHandled(g, w("LOG"), w("req1"))).toBe(true);
            expect(isHandled(g, w("WARN"), w("req1"))).toBe(true);
        });
    });

    describe("Installation", () => {
        it("installBuiltinEffects should install all browser effects", () => {
            const g = new WatchedGraph();
            const unwatchMap = installBuiltinEffects(g);

            // Should return Map with unwatch functions
            expect(unwatchMap).toBeInstanceOf(Map);
            expect(unwatchMap.size).toBeGreaterThanOrEqual(3);

            // Check some key effects are installed
            expect(unwatchMap.has("LOG")).toBe(true);
            expect(unwatchMap.has("ERROR")).toBe(true);
            expect(unwatchMap.has("WARN")).toBe(true);
        });

        it("should register effect metadata in system context", () => {
            const g = new WatchedGraph();
            installBuiltinEffects(g);

            // Check that LOG is registered
            const typeQuads = matchGraph(
                g,
                pattern(
                    patternQuad(
                        w("LOG"),
                        w("type"),
                        w("effect!"),
                        w("system"),
                    ),
                ),
            );
            expect(typeQuads).toHaveLength(1);

            // Check category metadata
            const categoryQuads = matchGraph(
                g,
                pattern(
                    patternQuad(w("LOG"), w("category"), v("cat"), w("system")),
                ),
            );
            expect(categoryQuads).toHaveLength(1);
            expect(categoryQuads[0].get("cat")).toBe("io");
        });
    });

    describe("Custom Effects", () => {
        it("should allow installing custom effect", async () => {
            const g = new WatchedGraph();

            let executionCount = 0;

            installIOEffect(
                g,
                "CUSTOM",
                async (graph, ctx) => {
                    executionCount++;
                    const input = getInput(graph, ctx, "DATA");
                    return {
                        RESULT: `Processed: ${input}`,
                        COUNT: executionCount
                    };
                },
                {
                    category: "custom",
                    doc: "Custom test effect"
                }
            );

            g.add(q(w("req1"), w("DATA"), "test data", w("req1")));
            g.add(q(w("req1"), w("handle"), w("CUSTOM"), w("input")));

            await waitForEffect(g, w("CUSTOM"), w("req1"));

            expect(getOutput(g, w("req1"), w("RESULT"))).toBe("Processed: test data");
            expect(getOutput(g, w("req1"), w("COUNT"))).toBe(1);
            expect(executionCount).toBe(1);
        });

        it("should allow async custom effects", async () => {
            const g = new WatchedGraph();

            installIOEffect(
                g,
                "ASYNC_EFFECT",
                async (graph, ctx) => {
                    // Simulate async work
                    await new Promise(resolve => setTimeout(resolve, 50));
                    return { DONE: "TRUE" };
                },
                { category: "async" }
            );

            g.add(q(w("req1"), w("handle"), w("ASYNC_EFFECT"), w("input")));

            await waitForEffect(g, w("ASYNC_EFFECT"), w("req1"));

            expect(getOutput(g, w("req1"), w("DONE"))).toBe("TRUE");
        });

        it("should allow effects that access graph", async () => {
            const g = new WatchedGraph();

            installIOEffect(
                g,
                "GRAPH_READER",
                async (graph, ctx) => {
                    // Read from graph
                    const config = getInput(graph, ctx, "CONFIG_KEY");
                    const configValue = getInput(graph, w("config"), config);
                    return { VALUE: configValue };
                },
                { category: "reader" }
            );

            // Setup config data
            g.add(q(w("config"), w("max_size"), 100, w("config")));

            // Trigger effect
            g.add(q(w("req1"), w("CONFIG_KEY"), "max_size", w("req1")));
            g.add(q(w("req1"), w("handle"), w("GRAPH_READER"), w("input")));

            await waitForEffect(g, w("GRAPH_READER"), w("req1"));

            expect(getOutput(g, w("req1"), w("VALUE"))).toBe(100);
        });
    });
});
