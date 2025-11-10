import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { WatchedGraph } from "../src/algebra/watch.js";
import { installNodeEffects } from "../extensions/io-effects-node.js";
import {
    getOutput,
    isHandled,
} from "../extensions/io-effects.js";
import { quad as q } from "../src/algebra/quad.js";
import { word as w } from "../src/types.js";
import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

// Helper to wait for async effects to complete
async function waitForEffect(graph, effectName, ctx, timeout = 2000) {
    const start = Date.now();
    while (!isHandled(graph, effectName, ctx)) {
        if (Date.now() - start > timeout) {
            throw new Error(`Timeout waiting for ${effectName.spelling?.description || effectName}`);
        }
        await new Promise(resolve => setTimeout(resolve, 10));
    }
}

// Create unique test directory for this test run
const testDir = join(tmpdir(), `bassline-test-${Date.now()}`);

describe("IO-Effects-Node (Filesystem)", () => {
    beforeAll(async () => {
        // Create test directory
        await fs.mkdir(testDir, { recursive: true });
    });

    afterAll(async () => {
        // Clean up test directory
        try {
            await fs.rm(testDir, { recursive: true, force: true });
        } catch (error) {
            console.warn("Failed to clean up test directory:", error);
        }
    });

    describe("READ_FILE", () => {
        it("should read existing file content", async () => {
            const g = new WatchedGraph();
            installNodeEffects(g);

            const testFile = join(testDir, 'read-test.txt');
            const content = "Hello from file!";
            await fs.writeFile(testFile, content, 'utf8');

            g.add(q(w("req1"), w("PATH"), testFile, w("req1")));
            g.add(q(w("req1"), w("handle"), w("READ_FILE"), w("input")));

            await waitForEffect(g, w("READ_FILE"), w("req1"));

            expect(getOutput(g, w("req1"), w("CONTENT"))).toBe(content);
            expect(getOutput(g, w("req1"), w("SUCCESS"))).toBe("TRUE");
            expect(getOutput(g, w("req1"), w("PATH"))).toBe(testFile);
        });

        it("should handle missing file", async () => {
            const g = new WatchedGraph();
            installNodeEffects(g);

            const testFile = join(testDir, 'nonexistent.txt');

            g.add(q(w("req1"), w("PATH"), testFile, w("req1")));
            g.add(q(w("req1"), w("handle"), w("READ_FILE"), w("input")));

            await waitForEffect(g, w("READ_FILE"), w("req1"));

            expect(getOutput(g, w("req1"), w("SUCCESS"))).toBe("FALSE");
            expect(getOutput(g, w("req1"), w("ERROR"))).toContain("ENOENT");
        });

        it("should error when PATH is missing", async () => {
            const g = new WatchedGraph();
            installNodeEffects(g);

            g.add(q(w("req1"), w("handle"), w("READ_FILE"), w("input")));

            await waitForEffect(g, w("READ_FILE"), w("req1"));

            const error = getOutput(g, w("req1"), w("error"));
            expect(error).toContain("PATH");
        });

        it("should read UTF-8 content correctly", async () => {
            const g = new WatchedGraph();
            installNodeEffects(g);

            const testFile = join(testDir, 'utf8-test.txt');
            const content = "Hello 世界 🌍";
            await fs.writeFile(testFile, content, 'utf8');

            g.add(q(w("req1"), w("PATH"), testFile, w("req1")));
            g.add(q(w("req1"), w("handle"), w("READ_FILE"), w("input")));

            await waitForEffect(g, w("READ_FILE"), w("req1"));

            expect(getOutput(g, w("req1"), w("CONTENT"))).toBe(content);
        });
    });

    describe("WRITE_FILE", () => {
        it("should create new file with content", async () => {
            const g = new WatchedGraph();
            installNodeEffects(g);

            const testFile = join(testDir, 'write-new.txt');
            const content = "New file content";

            g.add(q(w("req1"), w("PATH"), testFile, w("req1")));
            g.add(q(w("req1"), w("CONTENT"), content, w("req1")));
            g.add(q(w("req1"), w("handle"), w("WRITE_FILE"), w("input")));

            await waitForEffect(g, w("WRITE_FILE"), w("req1"));

            expect(getOutput(g, w("req1"), w("SUCCESS"))).toBe("TRUE");
            expect(getOutput(g, w("req1"), w("BYTES"))).toBe(Buffer.byteLength(content, 'utf8'));

            // Verify file was created
            const actual = await fs.readFile(testFile, 'utf8');
            expect(actual).toBe(content);
        });

        it("should overwrite existing file", async () => {
            const g = new WatchedGraph();
            installNodeEffects(g);

            const testFile = join(testDir, 'write-overwrite.txt');
            await fs.writeFile(testFile, "Old content", 'utf8');

            const newContent = "Overwritten content";
            g.add(q(w("req1"), w("PATH"), testFile, w("req1")));
            g.add(q(w("req1"), w("CONTENT"), newContent, w("req1")));
            g.add(q(w("req1"), w("handle"), w("WRITE_FILE"), w("input")));

            await waitForEffect(g, w("WRITE_FILE"), w("req1"));

            const actual = await fs.readFile(testFile, 'utf8');
            expect(actual).toBe(newContent);
        });

        it("should error when PATH is missing", async () => {
            const g = new WatchedGraph();
            installNodeEffects(g);

            g.add(q(w("req1"), w("CONTENT"), "test", w("req1")));
            g.add(q(w("req1"), w("handle"), w("WRITE_FILE"), w("input")));

            await waitForEffect(g, w("WRITE_FILE"), w("req1"));

            const error = getOutput(g, w("req1"), w("error"));
            expect(error).toContain("PATH");
        });

        it("should error when CONTENT is missing", async () => {
            const g = new WatchedGraph();
            installNodeEffects(g);

            const testFile = join(testDir, 'write-no-content.txt');
            g.add(q(w("req1"), w("PATH"), testFile, w("req1")));
            g.add(q(w("req1"), w("handle"), w("WRITE_FILE"), w("input")));

            await waitForEffect(g, w("WRITE_FILE"), w("req1"));

            const error = getOutput(g, w("req1"), w("error"));
            expect(error).toContain("CONTENT");
        });

        it("should write UTF-8 content correctly", async () => {
            const g = new WatchedGraph();
            installNodeEffects(g);

            const testFile = join(testDir, 'write-utf8.txt');
            const content = "Hello 世界 🌍";

            g.add(q(w("req1"), w("PATH"), testFile, w("req1")));
            g.add(q(w("req1"), w("CONTENT"), content, w("req1")));
            g.add(q(w("req1"), w("handle"), w("WRITE_FILE"), w("input")));

            await waitForEffect(g, w("WRITE_FILE"), w("req1"));

            const actual = await fs.readFile(testFile, 'utf8');
            expect(actual).toBe(content);
        });
    });

    describe("APPEND_FILE", () => {
        it("should append to existing file", async () => {
            const g = new WatchedGraph();
            installNodeEffects(g);

            const testFile = join(testDir, 'append-existing.txt');
            await fs.writeFile(testFile, "Line 1\n", 'utf8');

            const appendContent = "Line 2\n";
            g.add(q(w("req1"), w("PATH"), testFile, w("req1")));
            g.add(q(w("req1"), w("CONTENT"), appendContent, w("req1")));
            g.add(q(w("req1"), w("handle"), w("APPEND_FILE"), w("input")));

            await waitForEffect(g, w("APPEND_FILE"), w("req1"));

            expect(getOutput(g, w("req1"), w("SUCCESS"))).toBe("TRUE");

            const actual = await fs.readFile(testFile, 'utf8');
            expect(actual).toBe("Line 1\nLine 2\n");
        });

        it("should create file if it doesn't exist", async () => {
            const g = new WatchedGraph();
            installNodeEffects(g);

            const testFile = join(testDir, 'append-new.txt');
            const content = "First line\n";

            g.add(q(w("req1"), w("PATH"), testFile, w("req1")));
            g.add(q(w("req1"), w("CONTENT"), content, w("req1")));
            g.add(q(w("req1"), w("handle"), w("APPEND_FILE"), w("input")));

            await waitForEffect(g, w("APPEND_FILE"), w("req1"));

            const actual = await fs.readFile(testFile, 'utf8');
            expect(actual).toBe(content);
        });

        it("should append multiple times", async () => {
            const g = new WatchedGraph();
            installNodeEffects(g);

            const testFile = join(testDir, 'append-multiple.txt');
            await fs.writeFile(testFile, "", 'utf8');

            // First append
            g.add(q(w("req1"), w("PATH"), testFile, w("req1")));
            g.add(q(w("req1"), w("CONTENT"), "Line 1\n", w("req1")));
            g.add(q(w("req1"), w("handle"), w("APPEND_FILE"), w("input")));
            await waitForEffect(g, w("APPEND_FILE"), w("req1"));

            // Second append
            g.add(q(w("req2"), w("PATH"), testFile, w("req2")));
            g.add(q(w("req2"), w("CONTENT"), "Line 2\n", w("req2")));
            g.add(q(w("req2"), w("handle"), w("APPEND_FILE"), w("input")));
            await waitForEffect(g, w("APPEND_FILE"), w("req2"));

            // Third append
            g.add(q(w("req3"), w("PATH"), testFile, w("req3")));
            g.add(q(w("req3"), w("CONTENT"), "Line 3\n", w("req3")));
            g.add(q(w("req3"), w("handle"), w("APPEND_FILE"), w("input")));
            await waitForEffect(g, w("APPEND_FILE"), w("req3"));

            const actual = await fs.readFile(testFile, 'utf8');
            expect(actual).toBe("Line 1\nLine 2\nLine 3\n");
        });

        it("should error when PATH is missing", async () => {
            const g = new WatchedGraph();
            installNodeEffects(g);

            g.add(q(w("req1"), w("CONTENT"), "test", w("req1")));
            g.add(q(w("req1"), w("handle"), w("APPEND_FILE"), w("input")));

            await waitForEffect(g, w("APPEND_FILE"), w("req1"));

            const error = getOutput(g, w("req1"), w("error"));
            expect(error).toContain("PATH");
        });

        it("should error when CONTENT is missing", async () => {
            const g = new WatchedGraph();
            installNodeEffects(g);

            const testFile = join(testDir, 'append-no-content.txt');
            g.add(q(w("req1"), w("PATH"), testFile, w("req1")));
            g.add(q(w("req1"), w("handle"), w("APPEND_FILE"), w("input")));

            await waitForEffect(g, w("APPEND_FILE"), w("req1"));

            const error = getOutput(g, w("req1"), w("error"));
            expect(error).toContain("CONTENT");
        });
    });

    describe("Integration", () => {
        it("should verify file was written", async () => {
            const g = new WatchedGraph();
            installNodeEffects(g);

            const testFile = join(testDir, 'verify-write.txt');
            const content = "Verification test";

            // Write via effect
            g.add(q(w("req1"), w("PATH"), testFile, w("req1")));
            g.add(q(w("req1"), w("CONTENT"), content, w("req1")));
            g.add(q(w("req1"), w("handle"), w("WRITE_FILE"), w("input")));
            await waitForEffect(g, w("WRITE_FILE"), w("req1"));

            // Verify with direct fs.readFile
            const actual = await fs.readFile(testFile, 'utf8');
            expect(actual).toBe(content);
        });
    });
});
