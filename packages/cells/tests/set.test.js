import { describe, expect, it } from "vitest";
import { intersection, union } from "../src/set.js";
import { installPackage } from "@bassline/core";
import cells from "../src/index.js";
import { vi } from "vitest";

installPackage(cells);

describe("set cell tests", () => {
    it("should create a union cell", () => {
        const cell = union.spawn(new Set([]));
        expect(cell.current()).toEqual(new Set([]));
    });
    it("should update with a new set", () => {
        const cell = union.spawn(new Set([]));
        cell.receive(new Set([1, 2, 3]));
        expect(cell.current()).toEqual(new Set([1, 2, 3]));
    });
    it("should ignore a subset", () => {
        const cell = union.spawn(new Set([1, 2, 3]));
        cell.emit = vi.fn();
        cell.receive(new Set([1, 2]));
        expect(cell.emit).not.toHaveBeenCalled();
        expect(cell.current()).toEqual(new Set([1, 2, 3]));
    });
    it("Should handle normal values as a set", () => {
        const cell = union.spawn();
        const arr = [1, 2, 3];
        cell.receive(arr);
        expect(cell.current()).toEqual(new Set(arr));
        const obj = { a: 1, b: 2, c: 3 };
        cell.receive(obj);
        expect(cell.current()).toEqual(new Set([...arr, obj]));
        const num = 4;
        cell.receive(num);
        expect(cell.current()).toEqual(new Set([...arr, obj, num]));
    });
});

describe("intersection cell tests", () => {
    it("should create a intersection cell", () => {
        const cell = intersection.spawn(new Set([]));
        expect(cell.current()).toEqual(new Set([]));
    });
    it("should update with a new set if the current set is empty", () => {
        const cell = intersection.spawn();
        cell.receive(new Set([1, 2, 3]));
        expect(cell.current()).toEqual(new Set([1, 2, 3]));
    });
    it("should contradict if there is no intersection", () => {
        const cell = intersection.spawn(new Set([1, 2, 3]));
        cell.contradiction = vi.fn();
        cell.receive(new Set([4, 5, 6]));
        expect(cell.contradiction).toHaveBeenCalled();
        expect(cell.current()).toEqual(new Set([1, 2, 3]));
    });
});
