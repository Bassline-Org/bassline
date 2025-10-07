import array from "./array.js";
import core from "./core.js";
import http from "./http.js";
import logic from "./logic.js";
import math from "./math.js";

export default {
    gadgets: {
        ...array.gadgets,
        ...core.gadgets,
        ...http.gadgets,
        ...logic.gadgets,
        ...math.gadgets,
    },
};
