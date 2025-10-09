import { describe, expect, it } from "vitest";
import { fromSpec, installPackage } from "@bassline/core";
import systems from "../src/index.js";
import cells from "@bassline/cells";
import { sex } from "../src/sex.js";
import { installTaps } from "@bassline/taps";

installTaps();
installPackage(systems);
installPackage(cells);

describe("sex (sequential execution)", () => {
    it("should spawn gadgets sequentially", async () => {
        const actions = [
            ["spawn", "counter", {
                pkg: "@bassline/cells/numeric",
                name: "max",
                state: 0,
            }],
            ["spawn", "display", {
                pkg: "@bassline/cells/numeric",
                name: "max",
                state: 10,
            }],
        ];

        const executor = sex.spawn(actions);

        // Wait for completion
        await new Promise((resolve) => {
            executor.tapOn("completed", (env) => {
                expect(env.spawned.counter).toBeDefined();
                expect(env.spawned.display).toBeDefined();
                expect(env.spawned.counter.current()).toBe(0);
                expect(env.spawned.display.current()).toBe(10);
                resolve();
            });
        });

        // Trigger execution
        executor.receive(actions);
    });

    it("should handle ref substitution", async () => {
        const actions = [
            ["spawn", "counter", {
                pkg: "@bassline/cells/numeric",
                name: "max",
                state: 5,
            }],
            ["send", "counter", 10],
        ];

        const executor = sex.spawn(actions);
        await new Promise((resolve) => {
            executor.tapOn("completed", (env) => {
                expect(env.spawned.counter.current()).toBe(10);
                resolve();
            });
        });
    });

    it("should substitute refs in nested state", async () => {
        const actions = [
            ["spawn", "source", {
                pkg: "@bassline/cells/numeric",
                name: "max",
                state: 42,
            }],
            ["ref", ["source"], ["spawn", "dependent", {
                pkg: "@bassline/cells/tables",
                name: "first",
                state: {
                    foo: "source",
                },
            }]],
        ];

        const executor = sex.spawn(actions);

        await new Promise((resolve) => {
            executor.tapOn("completed", (env) => {
                expect(env.spawned.dependent).toBeDefined();
                const depState = env.spawned.dependent.current();
                expect(depState.foo).toBe(env.spawned.source);
                resolve();
            });
        });
    });
});

describe("sex - vals", () => {
    it("should define and substitute vals", async () => {
        const actions = [
            ["val", "initial", 42],
            ["withVals", ["initial"], ["spawn", "counter", {
                pkg: "@bassline/cells/numeric",
                name: "max",
                state: { $val: "initial" },
            }]],
        ];

        const executor = sex.spawn(actions);

        await new Promise((resolve) => {
            executor.tapOn("completed", (env) => {
                expect(env.vals.initial).toBe(42);
                expect(env.spawned.counter.current()).toBe(42);
                resolve();
            });
        });

        executor.receive(actions);
    });

    it("should substitute multiple vals", async () => {
        const actions = [
            ["val", "min", 0],
            ["val", "max", 100],
            ["withVals", ["min", "max"], ["spawn", "range", {
                pkg: "@bassline/cells/tables",
                name: "first",
                state: {
                    min: { $val: "min" },
                    max: { $val: "max" },
                },
            }]],
        ];

        const executor = sex.spawn(actions);

        await new Promise((resolve) => {
            executor.tapOn("completed", (env) => {
                const state = env.spawned.range.current();
                expect(state.min).toBe(0);
                expect(state.max).toBe(100);
                resolve();
            });
        });

        executor.receive(actions);
    });

    it("should substitute vals in deeply nested objects", async () => {
        const actions = [
            ["val", "threshold", 50],
            ["withVals", ["threshold"], ["spawn", "config", {
                pkg: "@bassline/cells/tables",
                name: "first",
                state: {
                    settings: {
                        limits: {
                            upper: { $val: "threshold" },
                        },
                    },
                },
            }]],
        ];

        const executor = sex.spawn(actions);

        await new Promise((resolve) => {
            executor.tapOn("completed", (env) => {
                const state = env.spawned.config.current();
                expect(state.settings.limits.upper).toBe(50);
                resolve();
            });
        });

        executor.receive(actions);
    });

    it("should combine refs and vals", async () => {
        const actions = [
            ["val", "multiplier", 2],
            ["spawn", "source", {
                pkg: "@bassline/cells/numeric",
                name: "max",
                state: 10,
            }],
            ["ref", ["source"], ["withVals", ["multiplier"], [
                "spawn",
                "processor",
                {
                    pkg: "@bassline/cells/tables",
                    name: "first",
                    state: {
                        input: "source",
                        factor: { $val: "multiplier" },
                    },
                },
            ]]],
        ];

        const executor = sex.spawn(actions);

        await new Promise((resolve) => {
            executor.tapOn("completed", (env) => {
                const state = env.spawned.processor.current();
                expect(state.input).toBe(env.spawned.source);
                expect(state.factor).toBe(2);
                resolve();
            });
        });

        executor.receive(actions);
    });

    it("should not substitute vals outside withVals scope", async () => {
        const actions = [
            ["val", "secret", 999],
            ["spawn", "public", {
                pkg: "@bassline/cells/tables",
                name: "first",
                state: {
                    value: { $val: "secret" },
                },
            }],
        ];

        const executor = sex.spawn(actions);

        await new Promise((resolve) => {
            executor.tapOn("completed", (env) => {
                const state = env.spawned.public.current();
                // Should NOT be substituted (not in withVals scope)
                expect(state.value).toEqual({ $val: "secret" });
                resolve();
            });
        });

        executor.receive(actions);
    });
});
