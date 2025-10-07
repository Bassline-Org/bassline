import { bl, installPackage } from "./index.js";
bl();

import cells from "./patterns/cells/index.js";
installPackage(cells);

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
