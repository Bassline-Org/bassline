// Import core first - this ensures Value is fully initialized
import core from "./core.js";
// Export core immediately - this ensures Value is available
export * from "./core.js";

// Import functions and export it
import functions from "./functions.js";
export * from "./functions.js";

// Now import other modules that depend on core and functions
import async from "./async.js";
import conditions from "./conditions.js";
import gadgets from "./gadget.js";

export * from "./async.js";
export * from "./types.js";
export * from "./gadget.js";

export default {
    ...core,
    ...functions,
    ...async,
    ...conditions,
    ...gadgets,
};
