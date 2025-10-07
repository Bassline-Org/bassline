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
        if (typeof path !== "string") return;
        return { path };
    },
    enuf(next) {
        return next.path !== undefined;
    },
    async compute({ path }) {
        return await withRetry(
            async () => await fs.readFile(path, "utf-8"),
        );
    },
    toSpec() {
        return {
            pkg: this.pkg,
            name: this.name,
            state: {
                path: this.current()?.path,
            },
        };
    },
});
