import { compound, defineCompound } from "./compound.js";

const systemsPackage = {
    gadgets: {
        compound,
    },
};

// Export for manual use
export default systemsPackage;

// Also export individual gadgets and utilities
export { compound, defineCompound };
