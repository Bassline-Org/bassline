import { parse } from "./parser.js";
import { createRuntime } from "./runtime.js";
import { NativeFn, setMany, Str } from "./prelude/index.js";
import { readdirSync, readFileSync } from "fs";
import { Block } from "./prelude/index.js";
import wsServer from "./io/ws-server.js";
import file from "./io/file.js";

const replExtras = {
    "pwd": new Str(process.cwd()),
    "home": new Str(process.env.HOME || ""),
    "~": new Str(process.env.HOME || ""),
    "cd": new NativeFn(["path"], ([path], stream, context) => {
        process.chdir(path.to("string!").value);
        context.set("pwd", new Str(process.cwd()));
        return new Str(process.cwd());
    }),
    "ls": new NativeFn([], ([], stream, context) => {
        const files = readdirSync(process.cwd());
        return new Block(files.map((file) => new Str(file)));
    }),
    "cat": new NativeFn(["file"], ([file], stream, context) => {
        const content = readFileSync(file.to("string!").value, "utf8");
        return new Str(content);
    }),
    "exit": new NativeFn([], ([], stream, context) => {
        process.exit(0);
    }),
};

/**
 * @typedef {Object} Runtime
 * @property {Object} context - The runtime context
 * @property {Function} evaluate - Safely evaluates Bassline code, catching parse and runtime errors
 *
 * @typedef {Object} Repl
 * @property {Runtime} runtime - The runtime instance
 * @property {Function} evaluate - Safely evaluates Bassline code, catching parse and runtime errors
 */

/**
 * Create a REPL instance with safe evaluation
 *
 * @returns {Repl} A repl instance
 */
export function createRepl() {
    const runtime = createRuntime();
    setMany(runtime.context, {
        ...replExtras,
        ...wsServer,
        ...file,
    });
    return {
        runtime,
        evaluate(source) {
            try {
                const ast = parse(source);
                const result = runtime.evaluate(ast);
                return { ok: true, value: result };
            } catch (error) {
                return {
                    ok: false,
                    error: error.message,
                };
            }
        },
    };
}
