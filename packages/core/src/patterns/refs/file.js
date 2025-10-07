import { bl } from "../../index.js";
import { installTaps } from "../../extensions/taps.js";
import fs from "fs/promises";
installTaps();
const { gadgetProto } = bl();
import { refProto } from "./refs.js";

const isObject = (input) => typeof input === "object" && input !== null;
const isString = (input) => typeof input === "string";
function asPath(input) {
    if (!isObject(input)) return undefined;
    if (!isString(input?.path)) return undefined;
    return { path: input.path };
}

const pkg = "@bassline/refs";

const file = Object.create(refProto);
Object.assign(file, {
    pkg,
    name: "file",
    validate: asPath,
    shouldResolve(_path) {
        const { resolved } = this.current() || {};
        if (!resolved) return true;
        return false;
    },
    resolve({ path }) {
        this.update({ ...this.current(), path });
        const content = fs.readFile(path, "utf-8");
        content.then((content) => {
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
