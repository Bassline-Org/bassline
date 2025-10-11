#!/usr/bin/env node
import WebSocket from "ws";
import { readFileSync } from "fs";
import { Evaluator } from "./eval.js";
import { parse } from "./parser.js";

const args = process.argv.slice(2);

if (args.length === 0) {
    console.error("Usage:");
    console.error("  bassline <script.bl>       # Run script file locally");
    console.error('  bassline -e "code"         # Eval code string locally');
    console.error("  bassline -d <script.bl>    # Send script to daemon");
    console.error('  bassline -d -e "code"      # Send code string to daemon');
    process.exit(1);
}

const daemon = args[0] === "-d";
const inline = (daemon && args[1] === "-e") || args[0] === "-e";

let code;
if (daemon && inline) {
    code = args.slice(2).join(" ");
} else if (inline) {
    code = args.slice(1).join(" ");
} else if (daemon) {
    code = readFileSync(args[1], "utf-8");
} else {
    code = readFileSync(args[0], "utf-8");
}

if (daemon) {
    // Send to daemon
    const ws = new WebSocket("ws://localhost:8080");

    ws.on("open", () => {
        ws.send(code);
    });

    ws.on("message", (data) => {
        const msg = JSON.parse(data);
        if (msg.error) {
            console.error("Error:", msg.error);
            if (msg.stack) {
                console.error(msg.stack);
            }
            process.exit(1);
        } else if (msg.result !== undefined && msg.result !== null) {
            console.log(msg.result);
        }
        ws.close();
    });

    ws.on("error", (error) => {
        console.error("Connection error:", error.message);
        console.error("Is the daemon running? Start it with: bassline-daemon");
        process.exit(1);
    });
} else {
    const evaluator = new Evaluator();
    try {
        const result = evaluator.run(parse(code));
        const final = result instanceof Promise ? await result : result;
        if (final !== undefined) {
            console.log(final);
        }
    } catch (error) {
        console.error("Error:", error.message);
        process.exit(1);
    }
}
