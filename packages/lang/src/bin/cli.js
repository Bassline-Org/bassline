#!/usr/bin/env node
import { readdirSync, readFileSync } from "fs";
import { GLOBAL } from "../runtime.js";
import * as repl from "node:repl";
import { parse } from "../parser.js";
import { existsSync } from "fs";
import { Block, Str, Value } from "../datatypes/core.js";
import { setMany } from "../datatypes/context.js";
import { NativeFn } from "../datatypes/functions.js";

const args = process.argv.slice(2);

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

setMany(GLOBAL.context, replExtras);

// No arguments - start REPL
if (args.length === 0) {
    console.log("Bassline REPL - Type expressions to evaluate");
    console.log("Press Ctrl+D to exit\n");

    setMany(GLOBAL.context, replExtras);
    repl.start({
        prompt: ">> ",
        eval: (cmd, context, filename, callback) => {
            try {
                const ast = parse(cmd.trim());
                const result = GLOBAL.evaluate(ast);
                callback(null, result);
            } catch (e) {
                console.error(`Error: ${e.message}`);
                callback(null, undefined);
            }
        },
        writer: (output) => {
            if (output instanceof Value) {
                return `=> ${output.form().value}`;
            }
        },
    });
} else {
    // Run script file
    const filename = args[0];

    try {
        const source = readFileSync(filename, "utf8");
        const parsed = parse(source);
        const result = GLOBAL.evaluate(parsed);
    } catch (e) {
        console.error(`Error running ${filename}:`);
        console.error(e.message);
        process.exit(1);
    }
}
