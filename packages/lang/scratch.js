import { parse } from "@bassline/parser";
import { GLOBAL } from "./src/runtime.js";

const example = `    foo: 123
    bar: + 10 foo

    reduce [ + foo bar ]`;

const parsed = parse(example);

parsed.doBlock();
