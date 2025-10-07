import { bl, installPackage } from "./index.js";
import { installTaps } from "./extensions/taps.js";
bl();
installTaps();

import cells from "./patterns/cells/index.js";
import core from "./patterns/functions/core.js";
installPackage(cells);
installPackage(core);

const spec = {
    pkg: "core.cells.numeric",
    name: "max",
    state: 69,
};

const fromSpec = bl().fromSpec(spec);
console.log(fromSpec.current());

const tableSpec = {
    pkg: "core.cells.tables",
    name: "first",
    state: {},
};

const firstTable = bl().fromSpec(tableSpec);
firstTable.receive({ a: 1, b: 2 });

console.log(firstTable.current());

const constant = bl().fromSpec({
    pkg: "core.functions",
    name: "constant",
    state: 10,
});

constant.tapOn("computed", (computed) => {
    console.log(computed);
});

constant.receive(20);
