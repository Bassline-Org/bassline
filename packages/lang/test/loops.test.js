import { describe, test, expect } from "vitest";
import { Evaluator } from "../src/eval.js";
import { parse } from "../src/parser.js";

function run(code) {
    const evaluator = new Evaluator();
    const ast = parse(code);
    return evaluator.run(ast);
}

describe("Loop constructs", () => {
    test("loop - basic counting", () => {
        let output = [];
        const originalLog = console.log;
        console.log = (msg) => output.push(msg);

        run(`loop 3 [print "hello"]`);

        console.log = originalLog;
        expect(output).toEqual(["hello", "hello", "hello"]);
    });

    test("loop - returns last value", () => {
        const result = run(`
            x: 0
            loop 5 [x: (x + 1)]
            x
        `);
        expect(result).toBe(5);
    });

    test("repeat - with counter variable", () => {
        let output = [];
        const originalLog = console.log;
        console.log = (msg) => output.push(msg);

        run(`repeat i 3 [print i]`);

        console.log = originalLog;
        expect(output).toEqual([1, 2, 3]);
    });

    test("repeat - counter starts at 1", () => {
        const result = run(`
            sum: 0
            repeat i 5 [sum: (sum + i)]
            sum
        `);
        expect(result).toBe(15); // 1+2+3+4+5
    });

    test("while - conditional loop", () => {
        const result = run(`
            x: 0
            while [(x < 5)] [x: (x + 1)]
            x
        `);
        expect(result).toBe(5);
    });

    test("while - can skip execution", () => {
        const result = run(`
            x: 10
            while [(x < 5)] [x: (x + 1)]
            x
        `);
        expect(result).toBe(10);
    });

    test("foreach - iterate over block", () => {
        let output = [];
        const originalLog = console.log;
        console.log = (msg) => output.push(msg);

        run(`foreach item [1 2 3] [print item]`);

        console.log = originalLog;
        expect(output).toEqual([1, 2, 3]);
    });

    test("foreach - with strings", () => {
        let output = [];
        const originalLog = console.log;
        console.log = (msg) => output.push(msg);

        run(`foreach color ["red" "green" "blue"] [print color]`);

        console.log = originalLog;
        expect(output).toEqual(["red", "green", "blue"]);
    });

    test("break - exits loop early", () => {
        let output = [];
        const originalLog = console.log;
        console.log = (msg) => output.push(msg);

        run(`
            repeat i 10 [
                print i
                if (i = 3) [break] []
            ]
        `);

        console.log = originalLog;
        expect(output).toEqual([1, 2, 3]);
    });

    test("continue - skips to next iteration", () => {
        let output = [];
        const originalLog = console.log;
        console.log = (msg) => output.push(msg);

        run(`
            repeat i 5 [
                if (i = 3) [continue] []
                print i
            ]
        `);

        console.log = originalLog;
        expect(output).toEqual([1, 2, 4, 5]); // Skips 3
    });

    test("nested loops work correctly", () => {
        let output = [];
        const originalLog = console.log;
        console.log = (msg) => output.push(msg);

        run(`
            loop 2 [
                loop 2 [
                    print "x"
                ]
            ]
        `);

        console.log = originalLog;
        expect(output).toEqual(["x", "x", "x", "x"]);
    });

    test("forever with break", () => {
        let output = [];
        const originalLog = console.log;
        console.log = (msg) => output.push(msg);

        run(`
            x: 0
            forever [
                x: (x + 1)
                print x
                if (x = 3) [break] []
            ]
        `);

        console.log = originalLog;
        expect(output).toEqual([1, 2, 3]);
    });
});
