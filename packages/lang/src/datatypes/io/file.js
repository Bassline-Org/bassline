import { NativeFn } from "../functions.js";
import { Datatype, nil, Str } from "../core.js";
import { ContextChain } from "../context.js";
import { appendFileSync, readFileSync, writeFileSync } from "fs";
import { normalizeString } from "../../utils.js";

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
                return this.write(content);
            }),
        );
        this.set(
            "append",
            new NativeFn(["content"], ([content], stream, context) => {
                return this.append(content);
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
        return nil;
    }
    append(content) {
        appendFileSync(this.path().value, content.to("string!").value);
        return nil;
    }

    form() {
        const path = this.path().form();
        return new Str(`file-context! "${path.value}"`);
    }

    mold() {
        const path = this.path().mold();
        return new Str(`make file-context! "${path.value}"`);
    }

    static make(stream, context) {
        const path = stream.next().evaluate(stream, context).to("string!");
        return new FileContext(path.value, context);
    }
}

export default {
    "file-context!": new Datatype(FileContext),
};
