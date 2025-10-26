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
    "ssh://git@github.com:22/user/repo.git"
];

console.log("URL Parser Tests:");
testUrls.forEach((url) => {
    const result = urlParser.run(url);
    if (result.isError) {
        console.log(`✗ ${url} - Error at position ${result.index}: ${result.error}`);
    } else {
        console.log(`✓ ${url} - Parsed successfully`);
        const urlObj = result.result;
        const components = [];

        // Get all the components from the URL context
        try {
            if (urlObj.has("scheme").value)
                components.push(`scheme=${urlObj.get("scheme").spelling.description}`);
        } catch(e) {}

        try {
            if (urlObj.has("userinfo").value)
                components.push(`userinfo="${urlObj.get("userinfo").value}"`);
        } catch(e) {}

        try {
            if (urlObj.has("host").value)
                components.push(`host=${urlObj.get("host").spelling.description}`);
        } catch(e) {}

        try {
            if (urlObj.has("port").value)
                components.push(`port=${urlObj.get("port").value}`);
        } catch(e) {}

        try {
            if (urlObj.has("path").value)
                components.push(`path="${urlObj.get("path").value}"`);
        } catch(e) {}

        try {
            if (urlObj.has("query").value)
                components.push(`query="${urlObj.get("query").value}"`);
        } catch(e) {}

        try {
            if (urlObj.has("fragment").value)
                components.push(`fragment="${urlObj.get("fragment").value}"`);
        } catch(e) {}

        console.log(`  Components: ${components.join(", ")}`);
    }
});