import { installPackage } from "@bassline/core";
import { file } from "./file.js";
import { gadgetRef } from "./gadgetRef.js";
import { localRef } from "./localRef.js";

const refsPackage = {
    gadgets: {
        file,
        gadgetRef,
        localRef,
    },
};

// Auto-install on import
installPackage(refsPackage);

// Export for manual use
export default refsPackage;

// Also export individual gadgets
export { file, gadgetRef, localRef };
