import { NativeFn } from "../prelude/index.js";
import { Block, Datatype, nil, Num, Str, Word } from "../prelude/index.js";
import { ContextChain } from "../prelude/index.js";
import { normalizeString } from "../utils.js";
import { spawn } from "child_process";
import { evaluate } from "../evaluator.js";

class ProcessContext extends ContextChain {
    static type = normalizeString("process-context!");
    constructor(command, args, context) {
        super(context);
        this.set("command", command);
        this.set("args", args);
        this.set(
            "spawn",
            new NativeFn([], ([], stream, context) => {
                if (this.spawned) return nil;
                const command = this.command().value;
                const args = this.args().items.map((arg) => arg.value);
                this.spawned = spawn(command, args);
                this.spawned.stdout.on("data", (data) => {
                    const str = new Str(data.toString());
                    const block = new Block([new Word("stdout"), str]);
                    evaluate(block, this);
                });
                this.spawned.stderr.on("data", (data) => {
                    const str = new Str(data.toString());
                    const block = new Block([new Word("stderr"), str]);
                    evaluate(block, this);
                });
                this.spawned.on("exit", (code) => {
                    const num = new Num(code ?? 0);
                    //this.set("exit-code", num);
                    const block = new Block([new Word("close"), num]);
                    //console.log("close block: ", block.form().value);
                    evaluate(block, this);
                });
                return nil;
            }),
        );
        this.set(
            "send",
            new NativeFn(["data"], ([data], stream, context) => {
                this.send(data);
                return nil;
            }),
        );
        this.set(
            "kill",
            new NativeFn([], ([], stream, context) => {
                this.kill();
                return nil;
            }),
        );
    }

    command() {
        return this.get("command").to("string!");
    }
    args() {
        return this.get("args").to("block!");
    }

    send(data) {
        this.spawned.stdin.write(data.to("string!").value);
    }
    kill() {
        this.spawned.kill();
        //this.spawned = null;
    }

    form() {
        const command = this.command().form();
        const args = this.args().map((arg) => arg.form()).join(" ");
        return new Str(`process-context! "${command.value}" [${args.value}]`);
    }

    mold() {
        const command = this.command().mold();
        const args = this.args().mold();
        const entries = this.moldEntries();
        return new Str(
            `in (make process-context! ${command.value} ${args.value}) [
            ${entries}
            self
            ]`,
        );
    }

    static make(stream, context) {
        const command = stream.next().evaluate(stream, context).to("string!");
        const args = stream.next().evaluate(stream, context).to("block!");
        return new ProcessContext(command, args, context);
    }
}

export default {
    "process-context!": new Datatype(ProcessContext),
};
