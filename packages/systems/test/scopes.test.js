import { expect, test } from "vitest";
import { scope } from "@bassline/core";

test("scope", () => {
    const s = scope();
    expect(s).toBeDefined();
    expect(s.get("test")).toBeInstanceOf(Promise);
    s.set("test", "test");
    expect(s.get("test")).resolves.toBe("test");
});
