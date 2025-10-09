import { describe, expect, it } from "vitest";
import cells from "../src/index.js";
import { installPackage } from "@bassline/core";
import { ordinal, versioned } from "../src/versioned.js";

installPackage(cells);

describe("versioned cell tests", () => {
    it("should create a versioned cell", () => {
        const cell = ordinal.spawn();
        expect(cell.current()).toBeUndefined();
    });
    it("should update with a new value", () => {
        const cell = ordinal.spawn([0, 0]);
        cell.receive([1, 2]);
        expect(cell.current()).toEqual([1, 2]);
    });
    it(
        "should ignore a lower version",
        () => {
            const cell = ordinal.spawn([0, 0]);
            cell.receive([1, 2]);
            expect(cell.current()).toEqual([1, 2]);
            cell.receive([1, 1]);
            expect(cell.current()).toEqual([1, 2]);
        },
    );
});
