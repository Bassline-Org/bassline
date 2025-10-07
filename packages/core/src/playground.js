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
    {
        pkg: "@bassline/refs",
        name: "file",
        state: {
            path: "/tmp/foo.txt",
        },
        id: "fileRef",
    },
];

const otherSpec = [
    {
        pkg: "@bassline/relations",
        name: "wire",
        state: {},
    },
    {
        pkg: "@bassline/cells/numeric",
        name: "max",
        state: 0,
        id: "max",
    },
    {
        pkg: "@bassline/cells/numeric",
        name: "max",
        state: 0,
        id: "max2",
    },
];

const spawned = bl().fromSpec(otherSpec);
const [wire, max, max2] = spawned;

max.tapOn("changed", console.log);
max2.tapOn("changed", console.log);

wire.receive({
    source: max.asRef(),
    target: max2.asRef(),
});

wire.tapOn("changed", console.log);

max.receive(10);

console.log(max2.current());
console.log(wire.current());

// const spawned = bl().fromSpec(spec);
// const [max, first, firstWithCells, maxRef, fileRef] = spawned;

// maxRef.promise
//     .then((gadget) => {
//         console.log("gadget", gadget);
//     });

// fileRef.promise
//     .then((file) => {
//         console.log("file", file);
//     });
