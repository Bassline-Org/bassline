// object.test.js
import { describe, expect, it } from "vitest";
import { makeObject } from "../../src/proper/object.js";
import { make } from "../../src/proper/cells.js";
import { normalize } from "../../src/proper/spelling.js";

describe("makeObject", () => {
    it("creates simple object with one field", () => {
        // make object! [x: 42]
        const spec = make.block([
            make.setWord("x"),
            make.num(42),
        ]);

        const obj = makeObject(spec);

        expect(obj.get("x").value).toBe(42);
        expect(obj.get("self")).toBe(obj);
    });

    it("creates object with multiple fields", () => {
        // make object! [x: 1 y: 2 z: 3]
        const spec = make.block([
            make.setWord("x"),
            make.num(1),
            make.setWord("y"),
            make.num(2),
            make.setWord("z"),
            make.num(3),
        ]);

        const obj = makeObject(spec);

        expect(obj.get("x").value).toBe(1);
        expect(obj.get("y").value).toBe(2);
        expect(obj.get("z").value).toBe(3);
    });

    it("allows fields to reference each other", () => {
        // make object! [x: 10 y: x]
        const spec = make.block([
            make.setWord("x"),
            make.num(10),
            make.setWord("y"),
            make.word("x"),
        ]);

        const obj = makeObject(spec);

        expect(obj.get("y").value).toBe(10);
    });
});
