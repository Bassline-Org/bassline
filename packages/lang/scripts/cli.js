#!/usr/bin/env node
import { readFileSync } from "fs";
import { run } from "../src/run.js";
import { GLOBAL } from "../src/context.js";
import { normalize } from "../src/utils.js";
import { make } from "../src/cells/index.js";
import * as repl from "node:repl";

const args = process.argv.slice(2);

// No arguments - start REPL
if (args.length === 0) {
    console.log("Bassline REPL - Type expressions to evaluate");
    console.log("Press Ctrl+D to exit\n");
    const r = repl.start({
        prompt: ">> ",
        eval: (cmd, context, filename, callback) => {
            try {
                const result = run(cmd.trim());
                callback(null, result);
            } catch (e) {
                // Don't crash, just show error
                console.error(`Error: ${e.message}`);
                callback(null, undefined);
            }
        },
        writer: (output) => {
            // Pretty print output
            if (output && output.typeName) {
                return `=> ${output.typeName}: ${JSON.stringify(output)}`;
            }
            return String(output);
        },
    });
} else {
    // Run script file
    const filename = args[0];

    try {
        const source = readFileSync(filename, "utf8");

        // Set command line arguments in global context
        const cliArgs = args.slice(1).map((arg) => make.string(arg));
        GLOBAL.set(normalize("args"), make.block(cliArgs));

        // Run the script
        run(source);
    } catch (e) {
        console.error(`Error running ${filename}:`);
        console.error(e.message);
        //process.exit(1);
    }
}
