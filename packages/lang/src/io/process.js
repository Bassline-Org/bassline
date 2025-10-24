import {
    Block,
    ContextChain,
    datatype,
    Num,
    Str,
    TYPES,
    Word,
} from "../prelude/index.js";
import { nativeFn } from "../prelude/datatypes/functions.js";
import { spawn } from "child_process";
import { normalize } from "../utils.js";
TYPES.processContext = normalize("process-context!");

class ProcessContext extends ContextChain.typed(TYPES.processContext) {
    constructor(command, args, parent) {
        super(parent);
        this.set("command", command);
        this.set("args", args);
        this.set(
            "spawn",
            nativeFn("", () => {
                if (this.spawned) return this;
                const command = this.command().value;
                const args = this.args().items.map((arg) => arg.value);
                this.spawned = spawn(command, args);
                this.spawned.stdout.on("data", (data) => {
                    const str = new Str(data.toString());
                    const block = new Block([new Word("stdout"), str]);
                    block.doBlock(this);
                });
                this.spawned.stderr.on("data", (data) => {
                    const str = new Str(data.toString());
                    const block = new Block([new Word("stderr"), str]);
                    block.doBlock(this);
                });
                this.spawned.on("exit", (code) => {
                    const num = new Num(code ?? 0);
                    const block = new Block([new Word("close"), num]);
                    block.doBlock(this);
                });
                return this;
            }),
        );
        this.set(
            "send",
            nativeFn("data", (data) => {
                this.send(data);
                return this;
            }),
        );
        this.set(
            "kill",
            nativeFn("", () => {
                this.kill();
                return this;
            }),
        );
    }

    command() {
        return this.get("command").to(TYPES.string);
    }
    args() {
        return this.get("args").to(TYPES.block);
    }

    send(data) {
        this.spawned.stdin.write(data.to(TYPES.string).value);
    }
    kill() {
        this.spawned.kill();
    }
    form() {
        const command = this.command().form();
        const args = this.args().map((arg) => arg.form()).join(" ");
        return new Str(
            `make process-context! ["${command.value}" ${args.value}]`,
        );
    }

    mold() {
        return `make process-context! ["${this.command().mold()}" "${this.args().mold()}"]`;
    }

    static make(values, parent) {
        const [command, args] = values.items;
        return new ProcessContext(
            command.to(TYPES.string),
            args.to(TYPES.block),
            parent,
        );
    }
}

export default {
    "process-context!": datatype(ProcessContext),
};
