import { readFileSync } from "fs";
import { parse } from "../src/parser.js";
import { ex, createPreludeContext } from "../src/prelude.js";

const code = readFileSync(
    new URL("./gadget-system-demo.bl", import.meta.url),
    "utf-8",
);

console.log("=== Running Gadget System Demo ===\n");

const ctx = createPreludeContext();

try {
    const ast = parse(code);
    await ex(ctx, ast);
} catch (error) {
    console.error("Error:", error.message);
    console.error(error.stack);
}

console.log("\n=== Demo Complete ===");
