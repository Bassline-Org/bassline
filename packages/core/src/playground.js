import { bl, installPackage } from "./index.js";
bl();

import cells from "./patterns/cells/index.js";
installPackage(cells);
const installed = bl().gadgets;
console.log(installed);

const numeric = installed["core.cells.numeric"];

const max = new numeric.Max(0);

max.receive(10);

console.log(max.current());
