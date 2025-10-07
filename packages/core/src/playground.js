import { bl, installPackage } from "./index.js";
import { installTaps } from "./extensions/taps.js";
import { installRegistry } from "./extensions/registry.js";
bl();
installTaps();
installRegistry();

import cells from "./patterns/cells/index.js";
import functions from "./patterns/functions/index.js";
import refs from "./patterns/refs/index.js";

installPackage(cells);
installPackage(functions);
installPackage(refs);

const spec = [
    {
        pkg: "@bassline/cells/numeric",
        name: "max",
        state: 69,
        id: "max",
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
    {
        pkg: "@bassline/refs",
        name: "gadgetRef",
        state: {
            id: "max",
        },
        id: "maxRef",
    },
];

const spawned = bl().fromSpec(spec);
const [max, first, firstWithCells, maxRef] = spawned;
