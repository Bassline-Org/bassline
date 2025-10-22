#!/usr/bin/env node
import { readdirSync, readFileSync } from "fs";
import { GLOBAL } from "../runtime.js";
import * as repl from "node:repl";
import { parse } from "../parser.js";
import { existsSync } from "fs";
import { Block, NativeFn, setMany, Str, Value } from "../prelude/index.js";
import wsServer from "../io/ws-server.js";
import file from "../io/file.js";
import processContext from "../io/process.js";

const args = process.argv.slice(2);

let interactiveMode = false;
let fileToLoad = null;

for (let i = 0; i < args.length; i++) {
    if (args[i] === "-i" || args[i] === "--interactive") {
        interactiveMode = true;
        if (i + 1 < args.length && !args[i + 1].startsWith("-")) {
            fileToLoad = args[i + 1];
            i++; // Skip the next argument since we consumed it
        }
    } else if (!args[i].startsWith("-")) {
        fileToLoad = args[i];
    }
}

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

setMany(GLOBAL.context, {
    ...replExtras,
    ...wsServer,
    ...file,
    ...processContext,
});

const rcPath = process.env.HOME + "/.basslinerc";
if (existsSync(rcPath)) {
    console.log("Loading ~/.basslinerc");
    const rcCode = readFileSync(rcPath, "utf8");
    GLOBAL.evaluate(parse(rcCode));
}

// Load file if specified
if (fileToLoad) {
    try {
        if (!existsSync(fileToLoad)) {
            console.error(`Error: File '${fileToLoad}' not found`);
            process.exit(1);
        }

        const source = readFileSync(fileToLoad, "utf8");
        const parsed = parse(source);
        const result = GLOBAL.evaluate(parsed);

        // Only print result if not entering interactive mode
        if (!interactiveMode) {
            if (result instanceof Value) {
                console.log(result.form().value);
            }
        } else {
            console.log(`Loaded ${fileToLoad}`);
        }
    } catch (e) {
        console.error(`Error running ${fileToLoad}:`);
        console.error(e.message);
        if (!interactiveMode) {
            process.exit(1);
        }
    }
}

// Start REPL only if:
// 1. No file was specified at all (args.length === 0), OR
// 2. Interactive mode was explicitly requested with -i
if (args.length === 0 || interactiveMode) {
    console.log("Bassline REPL - Type expressions to evaluate");
    console.log("Press Ctrl+D to exit\n");

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
}
