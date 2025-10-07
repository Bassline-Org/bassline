import { bl, installPackage } from "./index.js";
import { installTaps } from "./extensions/taps.js";
bl();
installTaps();

import cells from "./patterns/cells/index.js";
import functions from "./patterns/functions/index.js";
installPackage(cells);
installPackage(functions);

const spec = {
    pkg: "@bassline/cells/numeric",
    name: "max",
    state: 69,
};

const fromSpec = bl().fromSpec(spec);
console.log(fromSpec.current());

const tableSpec = {
    pkg: "@bassline/cells/tables",
    name: "first",
    state: {},
};

const firstTable = bl().fromSpec(tableSpec);
firstTable.receive({ a: 1, b: 2 });

console.log(firstTable.current());

const constant = bl().fromSpec({
    pkg: "@bassline/fn/core",
    name: "constant",
    state: 10,
});

constant.tapOn("computed", (computed) => {
    console.log(computed);
});

constant.receive(20);

const getSpec = {
    pkg: "@bassline/fn/http",
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
