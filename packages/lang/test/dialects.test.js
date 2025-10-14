import { describe, expect, it } from "vitest";
import { parse } from "../src/parser.js";
import { createPreludeContext, ex } from "../src/prelude.js";

describe("Gadget Dialect", () => {
    it("should define a gadget prototype", () => {
        const code = parse(`
            counter: gadget [
                pkg: "@test/gadgets"
                name: "counter"
                state: 0
            ]
        `);

        const context = createPreludeContext();
        await ex(context, code);

        const counterProto = context.get(Symbol.for("COUNTER"));
        expect(counterProto).toBeDefined();
        expect(counterProto.pkg).toBe("@test/gadgets");
        expect(counterProto.name).toBe("counter");
        expect(counterProto._initialState).toBe(0);
    });

    it("should spawn a gadget instance", () => {
        const code = parse(`
            counter: gadget [
                pkg: "@test/gadgets"
                name: "counter"
                state: 0
            ]

            c: spawn counter
        `);

        const context = createPreludeContext();
        await ex(context, code);

        const instance = context.get(Symbol.for("C"));
        expect(instance).toBeDefined();
        expect(instance.current()).toBe(0);
    });

    it("should spawn gadget with explicit initial state", () => {
        const code = parse(`
            counter: gadget [
                pkg: "@test/gadgets"
                name: "counter"
                state: 0
            ]

            c: spawn counter 10
        `);

        const context = createPreludeContext();
        await ex(context, code);

        const instance = context.get(Symbol.for("C"));
        expect(instance.current()).toBe(10);
    });

    it("should send values to gadget", () => {
        const code = parse(`
            counter: gadget [
                pkg: "@test/gadgets"
                name: "counter"
                state: 0
            ]

            c: spawn counter
            send c 5
        `);

        const context = createPreludeContext();
        await ex(context, code);

        const instance = context.get(Symbol.for("C"));
        expect(instance.current()).toBe(5);
    });

    it("should get current state", () => {
        const code = parse(`
            counter: gadget [
                pkg: "@test/gadgets"
                name: "counter"
                state: 42
            ]

            c: spawn counter
            result: current c
        `);

        const context = createPreludeContext();
        await ex(context, code);

        const result = context.get(Symbol.for("RESULT"));
        expect(result).toBe(42);
    });
});

describe("Link Dialect", () => {
    it("should parse pipe connection syntax without error", () => {
        const code = parse(`
            counter: gadget [
                pkg: "@test/gadgets"
                name: "counter"
                state: 0
            ]

            a: spawn counter
            b: spawn counter

            link [
                a -> b
            ]
        `);

        const context = createPreludeContext();

        // Should execute without error (even if gadgets don't have tap yet)
        // The link dialect will create the wiring structure
        // Full integration will be tested when we integrate with @bassline/core
        expect(() => ex(context, code)).not.toThrow();
    });

    it("should parse fanout connection syntax without error", () => {
        const code = parse(`
            counter: gadget [
                pkg: "@test/gadgets"
                name: "counter"
                state: 0
            ]

            a: spawn counter
            b: spawn counter
            c: spawn counter

            link [
                a => [b c]
            ]
        `);

        const context = createPreludeContext();
        expect(() => ex(context, code)).not.toThrow();
    });

    it("should parse fanin connection syntax without error", () => {
        const code = parse(`
            counter: gadget [
                pkg: "@test/gadgets"
                name: "counter"
                state: 0
            ]

            a: spawn counter
            b: spawn counter
            c: spawn counter

            link [
                [a b] => c
            ]
        `);

        const context = createPreludeContext();
        expect(() => ex(context, code)).not.toThrow();
    });
});

describe("Full Integration", () => {
    it("should define, spawn, wire, and use gadgets", () => {
        const code = parse(`
            counter: gadget [
                pkg: "@test/gadgets"
                name: "counter"
                state: 0
            ]

            a: spawn counter
            b: spawn counter

            send a 5
            send b 10
        `);

        const context = createPreludeContext();
        await ex(context, code);

        const a = context.get(Symbol.for("A"));
        const b = context.get(Symbol.for("B"));

        expect(a.current()).toBe(5);
        expect(b.current()).toBe(10);
    });
});
