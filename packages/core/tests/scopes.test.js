import { describe, expect, test } from "vitest";
import { scope } from "../src/scope.js";

describe("scope", () => {
    test("basic get/set", async () => {
        const s = scope();
        s.set("test", "value");
        expect(await s.get("test")).toBe("value");
    });

    test("get before set resolves when set is called", async () => {
        const s = scope();

        const promise = s.get("delayed");

        setTimeout(() => s.set("delayed", "resolved"), 10);

        expect(await promise).toBe("resolved");
    });

    test("multiple waiters resolve on set", async () => {
        const s = scope();

        const promise1 = s.get("shared");
        const promise2 = s.get("shared");
        const promise3 = s.get("shared");

        s.set("shared", "value");

        expect(await promise1).toBe("value");
        expect(await promise2).toBe("value");
        expect(await promise3).toBe("value");
    });

    test("get after set returns value immediately", async () => {
        const s = scope();
        s.set("immediate", "value");

        const result = await s.get("immediate");
        expect(result).toBe("value");
    });

    test("can store gadgets", async () => {
        const s = scope();
        const gadget = { current: () => 42 };

        s.set("gadget", gadget);
        expect(await s.get("gadget")).toBe(gadget);
        expect((await s.get("gadget")).current()).toBe(42);
    });

    test("can store promises", async () => {
        const s = scope();
        const promise = Promise.resolve("value");
        s.set("promise", promise);
        expect(await s.get("promise")).toBe("value");
    });

    test("can store promises that resolve later", async () => {
        const s = scope();
        setTimeout(() => s.set("longEntryForFoo", "value"), 100);
        s.set("foo", s.get("longEntryForFoo"));
        const long = s.get("longEntryForFoo");
        expect(await long).toBe("value");
        const foo = s.get("foo");
        expect(await foo).toBe(await long);
    });
});
