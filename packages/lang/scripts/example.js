import { readFile } from "fs/promises";
import { Evaluator } from "../src/eval.js";
import { parse } from "../src/parser.js";

const source = await readFile("./examples/gadget.bl", "utf-8");

const parsed = parse(source);
console.log(parsed);
