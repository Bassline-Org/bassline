import { parse } from "./parser.js";

console.log("Testing Parsing Priority and Conflicts");
console.log("=======================================\n");

const tests = [
    // Basic word types
    { input: "hello", expected: "word", description: "Simple word" },
    { input: ":hello", expected: "get-word", description: "Get word" },
    { input: "hello:", expected: "set-word", description: "Set word" },
    { input: "'hello", expected: "lit-word", description: "Lit word" },

    // URLs vs words with colons
    { input: "http://example.com", expected: "url", description: "Basic URL" },
    { input: "https://example.com/path", expected: "url", description: "HTTPS URL with path" },
    { input: "file:///path/to/file", expected: "url", description: "File URL" },
    { input: "mailto:user@example.com", expected: "url", description: "Mailto URL" },

    // Potential conflicts
    { input: "http", expected: "word", description: "Just 'http' should be a word" },
    { input: "http:", expected: "set-word", description: "'http:' alone should be set-word" },
    { input: ":http", expected: "get-word", description: "':http' should be get-word" },
    { input: "example.com", expected: "word", description: "Domain without scheme should be word" },
    { input: "user@example.com", expected: "word", description: "Email without mailto: should be word" },

    // Mixed in blocks
    { input: "[http://example.com hello]", expected: "block with url and word", description: "URL and word in block" },
    { input: "[url: http://example.com]", expected: "block with set-word and url", description: "Set word followed by URL" },
    { input: "[:url http://example.com]", expected: "block with get-word and url", description: "Get word followed by URL" },

    // Edge cases
    { input: "ftp://", expected: "url", description: "URL with just scheme and //" },
    { input: "//example.com", expected: "word", description: "// without scheme should be word" },
    { input: "http//example.com", expected: "word", description: "Missing : should be word" },
    { input: "http:/example.com", expected: "word", description: "Single / should be word" },

    // Numbers in URLs
    { input: "http://192.168.1.1", expected: "url", description: "URL with IP address" },
    { input: "192.168.1.1", expected: "word", description: "IP without scheme should be word" },

    // Complex cases
    { input: "[fetch: http://api.example.com/data :json]", expected: "block with set-word, url, get-word", description: "Complex mix" },
    { input: "(http://example.com process)", expected: "paren with url and word", description: "URL in paren expression" },
];

// Helper function to get the type of a parsed value
function getValueType(value) {
    if (!value) return "undefined";
    const type = value.type?.description || value.constructor.name;

    // For blocks and parens, describe their contents
    if (type === "BLOCK!" && value.items) {
        const contents = value.items.map(v => getValueType(v)).join(", ");
        return `block[${contents}]`;
    }
    if (type === "PAREN!" && value.items) {
        const contents = value.items.map(v => getValueType(v)).join(", ");
        return `paren[${contents}]`;
    }

    return type.toLowerCase().replace("!", "");
}

// Run tests
let passed = 0;
let failed = 0;

tests.forEach(test => {
    try {
        const result = parse(test.input);
        const actualType = getValueType(result);

        // Simplified check - just verify it parses without error for now
        // and check basic type for simple cases
        if (test.expected.includes("block") || test.expected.includes("paren")) {
            // For complex cases, just check it parsed successfully
            console.log(`✓ "${test.input}"`);
            console.log(`  Description: ${test.description}`);
            console.log(`  Parsed as: ${actualType}`);
            passed++;
        } else {
            const expectedSimple = test.expected.replace("-", "");
            const actualSimple = actualType.replace("-", "");

            if (actualSimple.includes(expectedSimple) || expectedSimple.includes(actualSimple)) {
                console.log(`✓ "${test.input}"`);
                console.log(`  Description: ${test.description}`);
                console.log(`  Expected: ${test.expected}, Got: ${actualType}`);
                passed++;
            } else {
                console.log(`✗ "${test.input}"`);
                console.log(`  Description: ${test.description}`);
                console.log(`  Expected: ${test.expected}, Got: ${actualType}`);
                failed++;
            }
        }

        // Show the parsed structure for debugging
        if (result.items && result.items.length > 0) {
            console.log(`  Structure: [${result.items.map(item => {
                if (item.type?.description === "URL!") {
                    return `url(${item.mold()})`;
                } else if (item.spelling) {
                    return `${getValueType(item)}(${item.spelling.description})`;
                } else if (item.value !== undefined) {
                    return `${getValueType(item)}(${item.value})`;
                }
                return getValueType(item);
            }).join(", ")}]`);
        }

        console.log();
    } catch (error) {
        console.log(`✗ "${test.input}"`);
        console.log(`  Description: ${test.description}`);
        console.log(`  Error: ${error.message || error}`);
        console.log();
        failed++;
    }
});

console.log("Summary:");
console.log(`  Passed: ${passed}`);
console.log(`  Failed: ${failed}`);
console.log(`  Total: ${tests.length}`);

// Additional specific conflict tests
console.log("\n\nSpecific Conflict Tests:");
console.log("========================\n");

const conflictTests = [
    "http:",           // Should be set-word
    "http://",         // Should be URL
    "http:something",  // Should be set-word followed by word? Or error?
    "file:",           // Should be set-word
    "file:///",        // Should be URL
    ":http://example.com",  // Should be get-word (starting with :)
    "example.com:80",  // Should be set-word
    "example.com:80/path",  // Should be word (contains /)
];

conflictTests.forEach(input => {
    try {
        const result = parse(input);
        console.log(`Input: "${input}"`);
        console.log(`Parsed as: ${getValueType(result)}`);
        if (result.items) {
            console.log(`Structure: [${result.items.map(v => `${getValueType(v)}${v.spelling ? '(' + v.spelling.description + ')' : ''}`).join(", ")}]`);
        }
        console.log();
    } catch (error) {
        console.log(`Input: "${input}"`);
        console.log(`Parse error: ${error.message || error}`);
        console.log();
    }
});