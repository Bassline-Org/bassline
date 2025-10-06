import { bl } from "../index.js";
bl();
import { ops } from "../extensions/ops.js";
ops();

import { installCoreOps } from "./core.js";
import { installMathOps } from "./math.js";
import { installLogicOps } from "./logic.js";
import { installArrayOps } from "./array.js";

export function installDefaultOps() {
    installCoreOps();
    installMathOps();
    installLogicOps();
    installArrayOps();
}
