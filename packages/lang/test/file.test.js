import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { parse } from "../src/parser.js";
import { Evaluator } from "../src/eval.js";
import { File } from "../src/nodes.js";
import * as fs from "fs";

describe("File! datatype", () => {
    const testFile = "test-file-ops.txt";
    const testContent = "Hello, world!";

    afterEach(() => {
        try {
            fs.unlinkSync(testFile);
        } catch {
            // File may not exist
        }
    });

    function run(source) {
        const evaluator = new Evaluator();
        return evaluator.run(parse(source));
    }

    describe("Parser", () => {
        it("should parse unquoted file paths", () => {
            const result = parse("%test.txt");
            expect(result).toHaveLength(1);
            expect(result[0]).toBeInstanceOf(File);
            expect(result[0].path).toBe("test.txt");
        });

        it("should parse file paths with directories", () => {
            const result = parse("%path/to/file.js");
            expect(result).toHaveLength(1);
            expect(result[0]).toBeInstanceOf(File);
            expect(result[0].path).toBe("path/to/file.js");
        });

        it("should parse quoted file paths with spaces", () => {
            const result = parse('%"file with spaces.txt"');
            expect(result).toHaveLength(1);
            expect(result[0]).toBeInstanceOf(File);
            expect(result[0].path).toBe("file with spaces.txt");
        });

        it("should parse quoted file paths with escape sequences", () => {
            const result = parse('%"file\\nwith\\nnewlines.txt"');
            expect(result).toHaveLength(1);
            expect(result[0]).toBeInstanceOf(File);
            expect(result[0].path).toBe("file\nwith\nnewlines.txt");
        });
    });

    describe("Evaluator", () => {
        it("should evaluate file literals as File instances", () => {
            const source = `%test.txt`;
            const result = run(source);
            expect(result).toBeInstanceOf(File);
            expect(result.path).toBe("test.txt");
        });
    });

    describe("File operations", () => {
        it("should write and read files", () => {
            const source = `
                do [
                    write %${testFile} "${testContent}"
                    read %${testFile}
                ]
            `;
            const result = run(source);
            expect(result).toBe(testContent);
        });

        it("should check file existence", () => {
            // File doesn't exist
            const source1 = `exists? %${testFile}`;
            const result1 = run(source1);
            expect(result1).toBe(false);

            // Create file
            fs.writeFileSync(testFile, testContent);

            // File exists
            const source2 = `exists? %${testFile}`;
            const result2 = run(source2);
            expect(result2).toBe(true);
        });

        it("should delete files", () => {
            // Create file
            fs.writeFileSync(testFile, testContent);

            const source = `
                do [
                    delete %${testFile}
                    exists? %${testFile}
                ]
            `;
            const result = run(source);
            expect(result).toBe(false);
        });

        it("should check if path is directory", () => {
            // Create file
            fs.writeFileSync(testFile, testContent);

            const source = `dir? %${testFile}`;
            const result = run(source);
            expect(result).toBe(false);
        });

        it("should accept string paths as well as File instances", () => {
            const source = `
                do [
                    path: "${testFile}"
                    write path "${testContent}"
                    read path
                ]
            `;
            const result = run(source);
            expect(result).toBe(testContent);
        });
    });
});
