import { readFileSync } from "fs";
import { parse } from "../src/parser.js";
import { ex, createPreludeContext } from "../src/prelude.js";

// Read the Bassline file
const code = readFileSync(
    new URL("./repl-demo.bl", import.meta.url),
    "utf-8",
);

console.log("=== Running Bassline REPL Demo ===\n");

// Create context and execute
const ctx = createPreludeContext();

try {
    const ast = parse(code);
    ex(ctx, ast);
} catch (error) {
    console.error("Error:", error.message);
}

console.log("\n=== Demo Complete ===");
