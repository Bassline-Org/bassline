import { readFileSync } from "fs";
import { parse } from "../src/parser.js";
import { ex, createPreludeContext } from "../src/prelude.js";

const code = readFileSync(
    new URL("./gadget-system-comprehensive.bl", import.meta.url),
    "utf-8",
);

const ctx = createPreludeContext();

try {
    const ast = parse(code);
    await ex(ctx, ast);

    // Wait a bit for async operations (debounce/throttle)
    await new Promise(r => setTimeout(r, 500));
} catch (error) {
    console.error("Error:", error.message);
    console.error(error.stack);
    process.exit(1);
}
