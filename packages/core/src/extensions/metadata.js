const { gadgetProto } = bl();

import { tables } from "../patterns/cells/tables.js";

const metadataSymbol = Symbol("bassline-metadata");

// export function installMetadata() {
//     if (gadgetProto.metadata !== undefined) {
//         return;
//     }

//     Object.assign(gadgetProto, {
//         get metadata() {
//             if (this[metadataSymbol] === undefined) {
//                 this[metadataSymbol] = tables.first.spawn({});
//             }
//             return this[metadataSymbol];
//         },
//     });
// }
