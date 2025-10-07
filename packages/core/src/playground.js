import { bl, installPackage } from "./index.js";
import { installTaps } from "./extensions/taps.js";
bl();
installTaps();

import cells from "./patterns/cells/index.js";
import functions from "./patterns/functions/index.js";

installPackage(cells);
installPackage(functions);

const spec = [
    {
        pkg: "@bassline/cells/numeric",
        name: "max",
        state: 69,
    },
    {
        pkg: "@bassline/cells/tables",
        name: "first",
        state: {},
    },
    {
        pkg: "@bassline/cells/tables",
        name: "firstWithCells",
        state: {
            a: { pkg: "@bassline/cells/numeric", name: "max", state: 0 },
        },
    },
];

const spawned = bl().fromSpec(spec);
const [max, first, firstWithCells] = spawned;

console.log(max.current());
console.log(first.current());
console.log(firstWithCells.current());

firstWithCells.set({ a: 10 });

const asSpec = spawned.map((s) => s.toSpec());
console.log(asSpec);
