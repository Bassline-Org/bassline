import { bl } from "../index.js";
bl();
import { ops } from "../extensions/ops.js";
const { def, unary, named, varargs } = ops();

import { installCoreOps } from "./core.js";
import core from "./core.js";
import { installMathOps } from "./math.js";
import math from "./math.js";
import { installLogicOps } from "./logic.js";
import logic from "./logic.js";
import { installArrayOps } from "./array.js";
import array from "./array.js";
import { installHttpOps } from "./http.js";
import http from "./http.js";

export function installDefaultOps() {
    installCoreOps();
    installMathOps();
    installLogicOps();
    installArrayOps();
    installHttpOps();
}

export default {
    ...core,
    ...math,
    ...logic,
    ...array,
    ...http,
};
