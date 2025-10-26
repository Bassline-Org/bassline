#!/usr/bin/env node
import { readdirSync, readFileSync } from "fs";
import { GLOBAL } from "../runtime.js";
import * as repl from "node:repl";
import { parse } from "../parser.js";
import { promisify } from "node:util";
import { existsSync } from "fs";
import { Condition } from "../prelude/datatypes/conditions.js";
import {
    Block,
    nativeFn,
    setMany,
    Str,
    Task,
    TYPES,
    Value,
} from "../prelude/index.js";
import wsServer from "../io/ws-server.js";
import wsClient from "../io/ws-client.js";
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
    "cd": nativeFn("path", (path) => {
        process.chdir(path.to(TYPES.string).value);
        GLOBAL.context.set("pwd", new Str(process.cwd()));
        return new Str(process.cwd());
    }),
    "ls": nativeFn("", () => {
        const files = readdirSync(process.cwd());
        return new Block(files.map((file) => new Str(file)));
    }),
    "cat": nativeFn("file", (file) => {
        const content = readFileSync(file.to(TYPES.string).value, "utf8");
        return new Str(content);
    }),
    "exit": nativeFn("", () => {
        process.exit(0);
    }),
};

setMany(GLOBAL.context, {
    ...replExtras,
    ...file,
    ...processContext,
    ...wsServer,
    ...wsClient,
});

const rcPath = process.env.HOME + "/.basslinerc";
if (existsSync(rcPath)) {
    console.log("Loading ~/.basslinerc");
    const rcCode = readFileSync(rcPath, "utf8");
    const parsed = parse(rcCode);
    console.log("parsed", parsed);
    throw new Error("test");
    GLOBAL.evaluate(parse(rcCode));
    console.log("~/.basslinerc loaded");
}

// Load file if specified
if (fileToLoad) {
    //    try {
    if (!existsSync(fileToLoad)) {
        console.error(`Error: File '${fileToLoad}' not found`);
        process.exit(1);
    }

    const source = readFileSync(fileToLoad, "utf8");
    const parsed = parse(source);
    const result = GLOBAL.evaluate(parsed);

    // Only print result if not entering interactive mode
    if (!interactiveMode) {
        console.log("result", result);
        console.log(result?.form?.()?.value);
    } else {
        console.log(`Loaded ${fileToLoad}`);
    }
    //    } catch (e) {
    //console.error(`Error running ${fileToLoad}:`);
    //console.error(e.message);
    //if (!interactiveMode) {
    //    process.exit(1);
    //}
    //    }
}

// Start REPL only if:
// 1. No file was specified at all (args.length === 0), OR
// 2. Interactive mode was explicitly requested with -i
if (args.length === 0 || interactiveMode) {
    console.log("Bassline REPL - Type expressions to evaluate");
    console.log("Press Ctrl+D to exit\n");
    const replServer = repl.start({
        prompt: ">> ",
        eval: async (cmd, context, filename, callback) => {
            try {
                const ast = parse(cmd.trim());
                let result = await evaluateWithConditions(
                    ast,
                    GLOBAL.context,
                );
                console.log("result", result);
                if (result instanceof Task) {
                    result = await result.value;
                }
                console.log("result", result);
                callback(null, result);
            } catch (e) {
                console.error("error", e);
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
    const question = promisify(replServer.question).bind(replServer);
    const formatMessage = (message) => {
        return `Condition: ${message.value}\n    <~ `;
    };
    const prompt = async (message) => {
        const answer = await question(message);
        return new Str(answer);
    };
    GLOBAL.context.set(
        "prompt",
        nativeFn("message", (message) => {
            return new Task(
                prompt(formatMessage(message)),
            );
        }),
    );

    async function evaluateWithConditions(ast, ctx) {
        let result = ast.doBlock(ctx);

        while (result instanceof Condition) {
            const handler = result.get("type");
            const answer = await prompt(formatMessage(handler));
            const parsed = parse(answer);
            result = parsed.doBlock(result);
        }

        return result;
    }
}
