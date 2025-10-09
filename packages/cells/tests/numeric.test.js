import cells from "../src/index.js";
import { max, min } from "../src/numeric.js";
import { describe, expect, it } from "vitest";
import { fromSpec, installPackage } from "@bassline/core";

installPackage(cells);

describe("max cell tests", () => {
    it("should create a max cell", () => {
        const cell = max.spawn(0);
        expect(cell.current()).toBe(0);
    });

    it("should update with increasing numbers", () => {
        const cell = max.spawn(0);
        cell.receive(1);
        expect(cell.current()).toBe(1);
    });

    it("should ignore decreasing numbers", () => {
        const cell = max.spawn(0);
        cell.receive(-1);
        expect(cell.current()).toBe(0);
    });

    it("should ignore the same number", () => {
        const cell = max.spawn(0);
        let canary;
        cell.emit = function (data) {
            canary = data;
        };
        cell.receive(0);
        expect(canary).toBeUndefined();
    });

    it("Should handle strings as numbers", () => {
        const cell = max.spawn(0);
        cell.receive("1");
        expect(cell.current()).toBe(1);
    });

    it("Should handle random entries", () => {
        const cell = max.spawn(0);
        cell.receive({});
        expect(cell.current()).toBe(0);
    });
    it("Should handle arrays", () => {
        const cell = max.spawn(0);
        cell.receive([1, 2, 3]);
        expect(cell.current()).toBe(0);
    });
    it("Should handle objects", () => {
        const cell = max.spawn(0);
        cell.receive({ a: 1, b: 2, c: 3 });
        expect(cell.current()).toBe(0);
    });
    if (
        "Should handled NaN", () => {
            const cell = max.spawn(0);
            cell.receive(NaN);
            expect(cell.current()).toBe(0);
        }
    );
    it("Should handle Infinity", () => {
        const cell = max.spawn(0);
        cell.receive(Infinity);
        expect(cell.current()).toBe(Infinity);
    });
    it("Should handle -Infinity", () => {
        const cell = max.spawn(0);
        cell.receive(-Infinity);
        expect(cell.current()).toBe(0);
    });

    it("should be able to be created from a spec", async () => {
        const cell = await fromSpec({
            pkg: "@bassline/cells/numeric",
            name: "max",
            state: 0,
        });
        expect(cell.current()).toBe(0);
        cell.receive(10);
        expect(cell.current()).toBe(10);
    });
});

describe("min cell tests", () => {
    it("should create a min cell", () => {
        const cell = min.spawn(0);
        expect(cell.current()).toBe(0);
    });

    it("should update with decreasing numbers", () => {
        const cell = min.spawn(0);
        cell.receive(-1);
        expect(cell.current()).toBe(-1);
    });

    it("should ignore increasing numbers", () => {
        const cell = min.spawn(0);
        cell.receive(1);
        expect(cell.current()).toBe(0);
    });

    it("should ignore the same number", () => {
        const cell = min.spawn(0);
        let canary;
        cell.emit = function (data) {
            canary = data;
        };
        cell.receive(0);
        expect(canary).toBeUndefined();
    });

    it("should be able to be created from a spec", async () => {
        const cell = await fromSpec({
            pkg: "@bassline/cells/numeric",
            name: "min",
            state: 0,
        });
    });
});
