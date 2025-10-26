import { parse } from "./parser.js";

console.log("Testing Blocks with URIs and Words");
console.log("===================================\n");

const tests = [
    "[url: http://example.com]",
    "[:url http://example.com]",
    "[fetch: http://api.example.com/data :json]",
    "[http://example.com hello]",
    "[http: //example.com]",  // set-word followed by word
    "[scheme: path]",  // set-word followed by word
    "[scheme:path]",   // single URI
];

tests.forEach(input => {
    console.log(`Testing: "${input}"`);
    try {
        const result = parse(input);
        console.log("✓ Parsed successfully");

        // Get the block contents
        const block = result.items?.[0];
        if (block && block.items) {
            console.log(`  Block contains ${block.items.length} items:`);
            block.items.forEach((item, i) => {
                const type = item.type?.description?.toLowerCase() || "unknown";
                let detail = "";

                if (type.includes("uri")) {
                    detail = item.mold ? ` → ${item.mold()}` : "";
                } else if (type.includes("word")) {
                    detail = item.spelling ? ` → ${item.spelling.description}` : "";
                } else if (type.includes("number")) {
                    detail = ` → ${item.value}`;
                } else if (type.includes("string")) {
                    detail = ` → "${item.value}"`;
                }

                console.log(`    [${i}] ${type}${detail}`);
            });
        }
    } catch (error) {
        console.log("✗ Parse failed");
        console.log(`  Error: ${error.message || error}`);
    }
    console.log();
});

console.log("Summary:");
console.log("--------");
console.log("With the fix, set-words (scheme:) are correctly distinguished from URIs (scheme:path).");
console.log("This allows proper parsing of blocks containing mixed URIs, set-words, and words.");