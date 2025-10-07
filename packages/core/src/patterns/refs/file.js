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
    resolve({ path }) {
        this.update({ ...this.current(), path });
        withRetry(
            async () => await fs.readFile(path, "utf-8"),
        ).then((content) => {
            this.update({ ...this.current(), path, content, resolved: true });
            this.emit({ resolved: { path, content } });
        }).catch((error) => {
            this.error(error, { path });
        });
    },
    minState() {
        return {
            path: this.current()?.path,
        };
    },
});
