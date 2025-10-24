import {
    ContextChain,
    datatype,
    nativeFn,
    Str,
    TYPES,
} from "../prelude/datatypes/index.js";
import { appendFileSync, readFileSync, writeFileSync } from "fs";
import { normalize } from "../utils.js";

TYPES.fileContext = normalize("file-context!");

class FileContext extends ContextChain.typed(TYPES.fileContext) {
    constructor(path, parent) {
        super(parent);
        this.set("path", path);
        this.set(
            "read",
            nativeFn("", () => {
                const path = this.path().to(TYPES.string).value;
                console.log("path", path);
                return new Str(readFileSync(path, "utf8"));
            }),
        );
        this.set(
            "write",
            nativeFn("content", (content) => {
                writeFileSync(
                    this.path().value,
                    content.to(TYPES.string).value,
                );
                return this;
            }),
        );
    }
    path() {
        return this.get("path");
    }
    form() {
        const path = this.path().form();
        return new Str(`file-context! "${path.value}"`);
    }

    mold() {
        const path = this.path().mold();
        return `make file-context! "${path}"`;
    }

    static make(path, parent) {
        return new FileContext(path.to(TYPES.string), parent);
    }
}

export default {
    "file-context!": datatype(FileContext),
    "read-file": nativeFn("path", (path) => {
        return new Str(readFileSync(path.to(TYPES.string).value, "utf8"));
    }),
    "write-file": nativeFn("path content", (path, content) => {
        writeFileSync(
            path.to(TYPES.string).value,
            content.to(TYPES.string).value,
        );
        return this;
    }),
};
