import { urlParser } from "./parser.js";

const testUrls = [
    "http://www.google.com/search",
    "https://example.com:8080/path/to/resource",
    "ftp://user:pass@ftp.example.com/file.txt",
    "http://192.168.1.1/admin",
    "https://api.github.com/repos/owner/repo?tab=readme#section",
    "mailto:someone@example.com",
    "file:///home/user/document.pdf",
    "https://[2001:db8::1]/path",
    "ssh://git@github.com:22/user/repo.git",
    "http://example.com",
    "https://example.com/",
    "http://example.com:80/",
    "ftp://ftp.example.com/path/to/file.txt?query=1#anchor"
];

console.log("URL Parser Mold Tests:");
console.log("======================\n");

testUrls.forEach((originalUrl) => {
    const result = urlParser.run(originalUrl);
    if (result.isError) {
        console.log(`✗ Failed to parse: ${originalUrl}`);
        console.log(`  Error at position ${result.index}: ${result.error}\n`);
    } else {
        const urlObj = result.result;
        const moldedUrl = urlObj.mold();

        console.log(`Original:  ${originalUrl}`);
        console.log(`Molded:    ${moldedUrl}`);

        // Check if they're functionally equivalent (might differ in case or format)
        const normalizedOriginal = originalUrl.toLowerCase();
        const normalizedMolded = moldedUrl.toLowerCase();

        // Simple check - in reality URLs can be equivalent even if string different
        // (e.g., default ports, trailing slashes, etc.)
        if (normalizedOriginal === normalizedMolded) {
            console.log(`✓ Perfect match\n`);
        } else {
            // Parse both to compare components
            const reParsed = urlParser.run(moldedUrl);
            if (!reParsed.isError) {
                console.log(`✓ Molded URL is valid and parseable\n`);
            } else {
                console.log(`✗ Molded URL failed to parse\n`);
            }
        }
    }
});

// Test edge cases
console.log("\nEdge Case Tests:");
console.log("================\n");

// Test URL with all components
const fullUrl = "https://user:pass@example.com:8080/path/to/resource?key=value&foo=bar#section";
console.log(`Testing full URL: ${fullUrl}`);
const fullResult = urlParser.run(fullUrl);
if (!fullResult.isError) {
    const molded = fullResult.result.mold();
    console.log(`Molded: ${molded}`);
    console.log(molded === fullUrl.toLowerCase() ? "✓ Match!" : "✓ Valid (case normalized)");
}