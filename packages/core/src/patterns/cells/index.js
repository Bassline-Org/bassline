import numeric from "./numeric.js";
import set from "./set.js";
import tables from "./tables.js";
import versioned from "./versioned.js";
import unsafe from "./unsafe.js";

export default {
    gadgets: {
        ...numeric.gadgets,
        ...set.gadgets,
        ...tables.gadgets,
        ...versioned.gadgets,
        ...unsafe.gadgets,
    },
};
