import { Match, pattern, patternQuad } from "./algebra/pattern.js";
import { Control } from "./control.js";
import { readFileSync } from "fs";
import { variable as v, word as w } from "./types.js";
import { quad } from "./algebra/quad.js";

const control = new Control();

const script = readFileSync("./script.bl", "utf8");

const results = control.run(script);

for (const result of results) {
    if (Array.isArray(result)) {
        for (const res of result) {
            if (res instanceof Match) {
                console.log(res.prettyBindings());
                //                console.log(res.prettyQuads());
            }
        }
    }
}

//console.log(control.serialize());
