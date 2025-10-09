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

        executor.receive(actions);
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
                    input: "source", // This should be replaced with gadget
                },
            }]],
        ];

        const executor = sex.spawn(actions);

        await new Promise((resolve) => {
            executor.tapOn("completed", (env) => {
                expect(env.spawned.dependent).toBeDefined();
                const depState = env.spawned.dependent.current();
                expect(depState.input).toBe(env.spawned.source);
                resolve();
            });
        });

        executor.receive(actions);
    });
});
