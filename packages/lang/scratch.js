import { GLOBAL } from "./src/runtime.js";
import { parse } from "./src/parser.js";
import { Condition, Restart } from "./src/prelude/index.js";
import { createInterface } from "node:readline";

const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
});

const ctx = GLOBAL.context;

const conditionTest = parse(`
    a: 123
    b: "fuck"
    c: add a b
    print c
    print c
    cond: make condition! "fuck"
    print c

    cond

    print c
`);

async function handleRestarts(result) {
    while (result instanceof Restart || result instanceof Condition) {
        const cond = result.condition.value.description;
        console.log(result.continuation.form().value);
        const msg = `CONDITION: ${cond}\n\n>> `;

        const answer = await new Promise((resolve) => {
            rl.question(msg, resolve);
        });

        const parsed = parse(answer);
        if (result instanceof Restart) {
            parsed.doBlock(ctx);
            result = result.resume();
        } else {
            result = parsed.doBlock(ctx);
        }
    }
    return result;
}

// Run the test with restart handling
const initialResult = conditionTest.doBlock(ctx);
handleRestarts(initialResult).then((finalResult) => {
    console.log("\nFinal result:", finalResult);
    rl.close();
}).catch((err) => {
    console.error("Error:", err);
    rl.close();
});
