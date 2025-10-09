import { bl, installPackage } from "@bassline/core";
import { sex } from "./sex.js";

const systemsPackage = {
    gadgets: {
        sex,
    },
};

export function installSystems() {
    installPackage(systemsPackage);

    // Create rootSex on bl() if it doesn't exist
    if (!bl().rootSex) {
        bl().rootSex = sex.spawn([]);
    }
}

// Export for manual use
export default systemsPackage;

// Also export individual gadgets and utilities
export { sex };
