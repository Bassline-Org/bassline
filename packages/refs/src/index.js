import { file } from "./file.js";
import { gadgetRef } from "./gadgetRef.js";
import { localRef } from "./localRef.js";
import { protoRef } from "./protoRef.js";

const refsPackage = {
    gadgets: {
        file,
        gadgetRef,
        localRef,
        protoRef,
    },
};

// Export for manual use
export default refsPackage;

// Also export individual gadgets
export { file, gadgetRef, localRef, protoRef };

// Export utilities
export { getGadgetById } from "./utils.js";
