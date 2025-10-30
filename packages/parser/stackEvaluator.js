import { parse } from "./src/parser.js";
import { CELLS, TYPES } from "./src/data.js";
const { word, getWord, setWord } = TYPES;
function evaluate(item, context, stack = []) {
    const { type, value } = item;
    switch (type) {
        case word: {
            const bound = context[value];
            if (typeof bound === "function") {
                stack = bound(stack, context);
            } else {
                stack.push(bound);
            }
            break;
        }
        case getWord: {
            stack.push(context[value]);
            break;
        }
        case setWord: {
            const val = stack.pop();
            context[value] = val;
            stack.push(val);
            break;
        }
        default: {
            stack.push(value);
        }
    }
    return stack;
}

const context = {
    "ADD": (stack, context) => {
        const b = stack.pop();
        const a = stack.pop();
        stack.push(a + b);
        return stack;
    },
    "MUL": (s, c) => {
        const b = s.pop();
        const a = s.pop();
        s.push(a * b);
        return s;
    },
    "DUP": (stack, context) => {
        const top = stack[stack.length - 1];
        stack.push(top);
        return stack;
    },
    "SWAP": (stack, context) => {
        const b = stack.pop();
        const a = stack.pop();
        stack.push(b);
        stack.push(a);
        return stack;
    },
    "PRINT": (stack, context) => {
        console.log(stack[stack.length - 1]);
        return stack;
    },
};

const example = "foo: [3 4]";
const items = parse(example);
const stack = [];
for (const item of items.value) {
    evaluate(item, context, stack);
}
console.log(stack);
