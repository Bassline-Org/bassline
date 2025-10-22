import { ContextChain, Datatype, NativeFn, Str } from "../prelude/index.js";
import { appendFileSync, readFileSync, writeFileSync } from "fs";
import { normalizeString } from "../utils.js";

class FileContext extends ContextChain {
    static type = normalizeString("file-context!");
    constructor(path, context) {
        super(context);
        this.set("path", new Str(path));
        this.set(
            "read",
            new NativeFn([], ([], stream, context) => {
                return this.read();
            }),
        );
        this.set(
            "write",
            new NativeFn(["content"], ([content], stream, context) => {
                this.write(content);
                return this;
            }),
        );
        this.set(
            "append",
            new NativeFn(["content"], ([content], stream, context) => {
                this.append(content);
                return this;
            }),
        );
    }
    path() {
        return this.get("path").to("string!");
    }
    read() {
        return new Str(readFileSync(this.path().value, "utf8"));
    }
    write(content) {
        writeFileSync(this.path().value, content.to("string!").value);
    }
    append(content) {
        appendFileSync(this.path().value, content.to("string!").value);
    }

    form() {
        const path = this.path().form();
        return new Str(`file-context! "${path.value}"`);
    }

    mold() {
        const path = this.path().mold();
        return new Str(`make file-context! ${path.value}`);
    }

    static make(stream, context) {
        const path = stream.next().evaluate(stream, context).to("string!");
        return new FileContext(path.value, context);
    }
}

export default {
    "file-context!": new Datatype(FileContext),
    "read-file": new NativeFn(["path"], ([path], stream, context) => {
        return new Str(readFileSync(path.to("string!").value, "utf8"));
    }),
    "write-file": new NativeFn(
        ["path", "content"],
        ([path, content], stream, context) => {
            writeFileSync(
                path.to("string!").value,
                content.to("string!").value,
            );
            return content;
        },
    ),
};
