import { parse } from "./parser.js";

console.log("Testing Empty Path Handling");
console.log("===========================\n");

const tests = [
    { input: "foo:", expected: "set-word", description: "Set-word with no path" },
    { input: "foo:bar", expected: "uri", description: "URI with path" },
    { input: "http:", expected: "set-word", description: "HTTP set-word" },
    { input: "http://", expected: "uri", description: "HTTP URI with empty path but authority" },
    { input: "http://example.com", expected: "uri", description: "HTTP URI with host" },
    { input: "mailto:", expected: "set-word", description: "Mailto with no address" },
    { input: "mailto:user@example.com", expected: "uri", description: "Mailto with address" },
    { input: "file:", expected: "set-word", description: "File with no path" },
    { input: "file:///path", expected: "uri", description: "File URI with path" },
    { input: "scheme:", expected: "set-word", description: "Generic scheme with no path" },
    { input: "scheme:path", expected: "uri", description: "Generic URI with path" },
    { input: "a:", expected: "set-word", description: "Single letter set-word" },
    { input: "a:b", expected: "uri", description: "Single letter URI" },
];

tests.forEach(test => {
    try {
        const result = parse(test.input);
        const firstItem = result.items?.[0];
        let actualType = "unknown";

        if (firstItem) {
            const typeName = firstItem.type?.description?.toLowerCase() || "";
            if (typeName.includes("uri")) {
                actualType = "uri";
            } else if (typeName.includes("set-word")) {
                actualType = "set-word";
            } else if (typeName.includes("get-word")) {
                actualType = "get-word";
            } else if (typeName.includes("word")) {
                actualType = "word";
            }
        }

        const matches = actualType === test.expected;
        console.log(`${matches ? '✓' : '✗'} "${test.input}"`);
        console.log(`  Description: ${test.description}`);
        console.log(`  Expected: ${test.expected}, Got: ${actualType}`);

        if (actualType === "uri" && firstItem.mold) {
            console.log(`  URI mold: ${firstItem.mold()}`);
        } else if (actualType === "set-word" && firstItem.spelling) {
            console.log(`  Set-word: ${firstItem.spelling.description}`);
        }

        if (!matches) {
            console.log(`  ** MISMATCH **`);
        }
        console.log();

    } catch (error) {
        console.log(`✗ "${test.input}"`);
        console.log(`  Description: ${test.description}`);
        console.log(`  Error: ${error.message || error}`);
        console.log();
    }
});

console.log("\nSummary:");
console.log("--------");
console.log("Set-words (scheme:) should NOT be parsed as URIs with empty paths.");
console.log("Only scheme:path combinations should be parsed as URIs.");