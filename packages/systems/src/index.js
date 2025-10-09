import { installPackage } from "@bassline/core";
import { compound } from "./compound.js";

const systemsPackage = {
    gadgets: {
        compound,
    },
};

// Auto-install on import
installPackage(systemsPackage);

// Export for manual use
export default systemsPackage;

// Also export individual gadgets and utilities
export { compound };
export { createScope } from "./scope.js";
export { createCompoundProto } from "./compoundProto.js";
