import { compound, defineCompound } from "./compound.js";
import { sex } from "./sex.js";

const systemsPackage = {
    gadgets: {
        compound,
        sex,
    },
};

// Export for manual use
export default systemsPackage;

// Also export individual gadgets and utilities
export { compound, defineCompound, sex };
