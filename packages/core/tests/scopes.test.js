import { expect, test } from "vitest";
import { scope } from "../src/scope.js";

test("basic scope", async () => {
    const s = scope();
    expect(s).toBeDefined();
    const val = s.get("test");
    s.set("test", "test");
    expect(await val).toBe("test");
});
