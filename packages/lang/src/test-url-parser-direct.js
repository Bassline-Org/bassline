import { urlParser } from "./parser.js";

// Test cases that might be incorrectly parsed as URLs
const tests = [
    "http:something",
    "example.com:80",
    "example.com:80/path",
    "http:/example.com",  // Only one slash
    "mail:user@test.com", // Not a valid scheme for our purposes
];

console.log("Direct URL Parser Tests:");
console.log("========================\n");

tests.forEach(input => {
    console.log(`Input: "${input}"`);
    const result = urlParser.run(input);

    if (result.isError) {
        console.log(`  ✓ Correctly rejected (not a URL)`);
        console.log(`  Error at position ${result.index}: ${result.error}`);
    } else {
        console.log(`  ✗ Incorrectly accepted as URL`);
        console.log(`  Parsed as: ${result.result.mold()}`);
        console.log(`  Remaining input: "${input.slice(result.index)}"`);
    }
    console.log();
});