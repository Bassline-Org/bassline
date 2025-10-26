import { parse } from "./parser.js";

// Test just the problematic block cases
const blockTests = [
    "[url: http://example.com]",
    "[:url http://example.com]"
];

blockTests.forEach(input => {
    console.log(`Testing: "${input}"`);
    try {
        const result = parse(input);
        console.log("✓ Parsed successfully");
        console.log("Result:", result);
        if (result.items) {
            result.items.forEach((item, i) => {
                console.log(`  Item ${i}: type=${item.type?.description}, constructor=${item.constructor.name}`);
                if (item.items) {
                    item.items.forEach((subitem, j) => {
                        console.log(`    Subitem ${j}: type=${subitem.type?.description}`);
                    });
                }
            });
        }
    } catch (error) {
        console.log("✗ Parse failed");
        console.log("Error:", error.message || error);
    }
    console.log();
});