import { readFile } from "fs/promises";
import { Evaluator } from "../src/eval.js";
import { parse } from "../src/parser.js";

const source = await readFile(
    new URL("./simple.bln", import.meta.url),
    "utf-8",
);

const evaluator = new Evaluator();
const result = evaluator.run(parse(source));
console.log(result);
