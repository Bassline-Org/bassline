import numeric from "./numeric.js";
import set from "./set.js";
import tables from "./tables.js";
import versioned from "./versioned.js";
import unsafe from "./unsafe.js";

const cellsPackage = {
    gadgets: {
        ...numeric.gadgets,
        ...set.gadgets,
        ...tables.gadgets,
        ...versioned.gadgets,
        ...unsafe.gadgets,
    },
};

// Export for manual use
export default cellsPackage;

// Also export individual gadgets for convenience
export * from "./numeric.js";
export * from "./set.js";
export * from "./tables.js";
export * from "./versioned.js";
export * from "./unsafe.js";
