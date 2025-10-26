import { parse, uriParser } from "./parser.js";
import { choice, sequenceOf, char } from "arcsecond/index.js";

console.log("Debug Parsing Issue");
console.log("===================\n");

// Test the URI parser directly
const input1 = "scheme:path]";
console.log(`Testing URI parser on: "${input1}"`);
const uriResult = uriParser.run(input1);
if (uriResult.isError) {
    console.log(`  Failed at position ${uriResult.index}: ${uriResult.error}`);
} else {
    console.log(`  Success!`);
    console.log(`  Consumed: "${input1.slice(0, uriResult.index)}"`);
    console.log(`  Remaining: "${input1.slice(uriResult.index)}"`);
}
console.log();

// Test if it's consuming the closing bracket
const input2 = "url: http://example.com]";
console.log(`Testing URI parser on: "${input2}"`);
const uriResult2 = uriParser.run(input2);
if (uriResult2.isError) {
    console.log(`  Failed at position ${uriResult2.index}: ${uriResult2.error}`);
} else {
    console.log(`  Success!`);
    console.log(`  Consumed: "${input2.slice(0, uriResult2.index)}"`);
    console.log(`  Remaining: "${input2.slice(uriResult2.index)}"`);
}
console.log();

// Try parsing the problematic inputs
const problematicInputs = [
    "[scheme:path]",
    "[url: http://example.com]",
    "[:url http://example.com]"
];

console.log("Full parse tests:");
console.log("-----------------\n");

problematicInputs.forEach(input => {
    console.log(`Input: "${input}"`);
    try {
        const result = parse(input);
        console.log("  ✓ Parsed successfully");
    } catch (error) {
        console.log(`  ✗ Error: ${error.message || error}`);

        // Try to understand what's happening
        // Remove the brackets and parse the content
        const content = input.slice(1, -1);
        console.log(`  Trying content without brackets: "${content}"`);
        try {
            const contentResult = parse(content);
            console.log(`    Content parses successfully as: ${contentResult.items?.map(i => i.type?.description).join(", ")}`);
        } catch (e) {
            console.log(`    Content also fails: ${e.message || e}`);
        }
    }
    console.log();
});