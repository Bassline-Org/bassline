import { bl, installPackage } from "./index.js";
import { installTaps } from "./extensions/taps.js";
import { installRegistry } from "./extensions/registry.js";
bl();
installTaps();
installRegistry();

import cells from "./patterns/cells/index.js";
import functions from "./patterns/functions/index.js";
import refs from "./patterns/refs/index.js";
import relations from "./patterns/relations/relationGadgets.js";

installPackage(cells);
installPackage(functions);
installPackage(refs);
installPackage(relations);

const fileSpec = {
    pkg: "@bassline/refs",
    name: "file",
    state: {},
};
const lastSpec = {
    pkg: "@bassline/cells/unsafe",
    name: "last",
    state: {},
};
const last = bl().fromSpec(lastSpec);
last.tapOn("changed", (c) => console.log("last changed", c));

const file = bl().fromSpec(fileSpec);

const wire = relations.gadgets.wire.spawn({});
file.receive({ path: "/tmp/foo.txt" });

wire.receive({
    source: file.asRef(),
    target: last.asRef(),
});

wire.promise.then(async (val) => {
    await new Promise((res) =>
        setTimeout(() => {
            const wireSpec = wire.toSpec();
            console.log("wireSpec", wireSpec);
            res(true);
        }, 5000)
    );
});
