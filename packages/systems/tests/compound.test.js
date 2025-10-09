import { bl, fromSpec, installPackage } from "@bassline/core";
import { compound, defineCompound } from "../src/compound.js";
import systems from "../src/index.js";
import cells from "@bassline/cells";
import refs from "@bassline/refs";
import { describe, expect, it } from "vitest";

installPackage(systems);
installPackage(cells);
installPackage(refs);

const example = defineCompound({
    pkg: "@bassline/systems",
    name: "example",
    state: {
        a: {
            pkg: "@bassline/cells/numeric",
            name: "max",
            state: 5,
        },
        b: {
            pkg: "@bassline/cells/numeric",
            name: "max",
            state: 10,
        },
    },
});

describe("compound", () => {
    it("build a compound", async () => {
        const c = example.spawn({});
        console.log(c.current());
        const [a, b] = await c.getMany(["a", "b"]);
        expect(a.current()).toEqual(5);
        expect(b.current()).toEqual(10);
    });
    it("should route updates to the gadgets", async () => {
        const c = example.spawn({});
        c.receive({ a: 10, b: 20 });
        const [a, b] = await c.getMany(["a", "b"]);
        expect(await a.current()).toEqual(10);
        expect(await b.current()).toEqual(20);
    });
    it("should allow binding gadgets", async () => {
        const c = example.spawn({});
        expect(await c.get("a")).toBeDefined();
        expect(await c.get("b")).toBeDefined();
        const cell = cells.gadgets.max.spawn(69);
        c.receive({ bind: { c: cell } });
        expect((await c.get("c")).current()).toEqual(69);
    });
    it("Should export cleanly", async () => {
        const c = example.spawn({});
        const cell = cells.gadgets.max.spawn(69);
        c.receive({ bind: { c: cell } });
        const [_a, _b, _c] = await c.getMany(["a", "b", "c"]);
        expect(_a.current()).toEqual(5);
        expect(_b.current()).toEqual(10);
        expect(_c.current()).toEqual(69);
        const spec = c.toSpec();

        const newDef = defineCompound({
            pkg: spec.pkg,
            name: "example2",
            state: spec.state,
        });
        installPackage({
            gadgets: {
                newDef,
            },
        });

        const newC = newDef.spawn({
            d: {
                pkg: "@bassline/cells/numeric",
                name: "max",
                state: 100,
            },
        });

        {
            const [a, b, c, d] = await newC.getMany(["a", "b", "c", "d"]);
            expect(a.current()).toEqual(5);
            expect(b.current()).toEqual(10);
            expect(c.current()).toEqual(69);
            expect(d.current()).toEqual(100);
        }

        {
            const newFromSpec = await fromSpec({
                pkg: "@bassline/systems",
                name: "example2",
                state: {
                    a: {
                        pkg: "@bassline/cells/numeric",
                        name: "max",
                        state: 420,
                    },
                },
            });
            console.log("newFromSpec: ", newFromSpec);
            const [a, b, c] = await newFromSpec.getMany([
                "a",
                "b",
                "c",
            ]);
            expect(a.current()).toEqual(420);
            expect(b.current()).toEqual(10);
            expect(c.current()).toEqual(69);
        }
    });
});
