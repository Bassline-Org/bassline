import { bl, installPackage } from "./index.js";
import { installTaps } from "./extensions/taps.js";
bl();
installTaps();

import cells from "./patterns/cells/index.js";
import core from "./patterns/functions/core.js";
import http from "./patterns/functions/http.js";
installPackage(cells);
installPackage(core);
installPackage(http);

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

const getSpec = {
    pkg: "core.functions.http",
    name: "get",
};

const getter = bl().fromSpec(getSpec);
getter.tapOn("computed", (computed) => {
    console.log(computed);
});

const url = "https://api.sampleapis.com/futurama/info";

getter.receive({
    url,
    headers: {
        "Accept": "application/json",
    },
});
