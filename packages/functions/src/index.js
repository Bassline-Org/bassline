import { installPackage } from "@bassline/core";
import array from "./array.js";
import core from "./core.js";
import http from "./http.js";
import logic from "./logic.js";
import math from "./math.js";

const functionsPackage = {
    gadgets: {
        ...array.gadgets,
        ...core.gadgets,
        ...http.gadgets,
        ...logic.gadgets,
        ...math.gadgets,
    },
};

// Auto-install on import
installPackage(functionsPackage);

export default functionsPackage;
