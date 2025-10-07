import { bl } from "../../index.js";
import { installTaps } from "../../extensions/taps.js";
import fs from "fs/promises";
installTaps();
const { gadgetProto } = bl();
import { refProto, withRetry } from "./refs.js";

const pkg = "@bassline/refs";

export const file = Object.create(refProto);
Object.assign(file, {
    pkg,
    name: "file",
    validate(input) {
        const path = input?.path;
        if (typeof path !== "string") return undefined;
        return { path };
    },
    canResolve({ path }) {
        if (path !== undefined) return true;
        return false;
    },
    tryResolve({ path }) {
        return withRetry(
            async () => await fs.readFile(path, "utf-8"),
        );
    },
    minState() {
        return {
            path: this.current()?.path,
        };
    },
});
