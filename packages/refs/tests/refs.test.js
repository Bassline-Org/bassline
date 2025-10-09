import { describe, expect, it } from "vitest";
import refs, { localRef } from "../src/index.js";
import { protoRef } from "../src/protoRef.js";
import { installPackage, scope } from "@bassline/core";
import cells from "@bassline/cells";

installPackage(refs);

describe("refs", () => {
    it("should resolve a gadget proto", async () => {
        const ref = protoRef.spawn({
            pkg: "@bassline/refs",
            name: "protoRef",
        });
        const proto = await ref.promise;
        expect(proto).toBeDefined();
        const spawned = proto.spawn({
            pkg: "@bassline/refs",
            name: "file",
        });
        expect(spawned).toBeDefined();
        const fileProto = await spawned.promise;
        expect(fileProto).toBeDefined();
    });

    it("should be handle late binding", async () => {
        const ref = protoRef.spawn({
            pkg: "@bassline/cells/numeric",
            name: "max",
        });

        const race = Promise.race([
            ref.promise,
            new Promise((resolve) => setTimeout(() => resolve("timeout"), 100)),
        ]);

        expect(await race).toBe("timeout");
        installPackage(cells);

        const proto = await ref.promise;
        expect(proto).toBeDefined();
    });

    it("Should work with scopes", async () => {
        const s = scope();
        let ref;
        s.enter(() => {
            ref = localRef.spawn({ name: "foo" });
        });
        const raced = Promise.race([
            ref.promise,
            new Promise((resolve) => setTimeout(() => resolve("timeout"), 100)),
        ]);
        expect(await raced).toBe("timeout");

        s.set("foo", "bar");

        const proto = await ref.promise;
        expect(proto).toEqual("bar");
    });
});
