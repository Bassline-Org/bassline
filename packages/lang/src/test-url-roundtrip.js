import { urlParser } from "./parser.js";

console.log("URL Round-trip Test (Parse -> Mold -> Parse)");
console.log("=============================================\n");

const testUrls = [
    "http://www.example.com/path",
    "https://user@host.com:443/path?query=value#fragment",
    "ftp://anonymous:password@ftp.example.org/files/document.pdf",
    "mailto:john.doe@example.com",
    "file:///Users/john/Documents/file.txt",
    "https://[::1]:8080/test",
    "ssh://git@github.com:22/user/repo.git"
];

testUrls.forEach(url => {
    console.log(`Testing: ${url}`);

    // First parse
    const parsed1 = urlParser.run(url);
    if (parsed1.isError) {
        console.log(`  ✗ Initial parse failed: ${parsed1.error}`);
        return;
    }

    // Mold back to string
    const molded = parsed1.result.mold();
    console.log(`  Molded: ${molded}`);

    // Parse the molded string
    const parsed2 = urlParser.run(molded);
    if (parsed2.isError) {
        console.log(`  ✗ Re-parse failed: ${parsed2.error}`);
        return;
    }

    // Mold again to verify stability
    const molded2 = parsed2.result.mold();
    console.log(`  Re-molded: ${molded2}`);

    // Check if molding is stable (idempotent)
    if (molded === molded2) {
        console.log(`  ✓ Round-trip successful and stable!\n`);
    } else {
        console.log(`  ⚠ Molding not stable: ${molded} !== ${molded2}\n`);
    }
});

// Test that components are preserved correctly
console.log("\nComponent Preservation Test:");
console.log("============================\n");

const componentTestUrl = "https://user:pass@example.com:8080/path/to/resource?key1=value1&key2=value2#section";
const result = urlParser.run(componentTestUrl);

if (!result.isError) {
    const url = result.result;
    console.log("Original URL:", componentTestUrl);
    console.log("\nExtracted Components:");

    if (url.has("scheme").value)
        console.log(`  scheme: "${url.get("scheme").spelling.description}"`);
    if (url.has("userinfo").value)
        console.log(`  userinfo: "${url.get("userinfo").value}"`);
    if (url.has("host").value)
        console.log(`  host: "${url.get("host").spelling.description}"`);
    if (url.has("port").value)
        console.log(`  port: ${url.get("port").value}`);
    if (url.has("path").value)
        console.log(`  path: "${url.get("path").value}"`);
    if (url.has("query").value)
        console.log(`  query: "${url.get("query").value}"`);
    if (url.has("fragment").value)
        console.log(`  fragment: "${url.get("fragment").value}"`);

    console.log("\nMolded back:", url.mold());
}