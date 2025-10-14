import { gadgetNative } from "../dialects/gadget.js";
import { linkNative } from "../dialects/link.js";

export function installDialects(context) {
    // gadget [block]
    // Define a gadget prototype
    context.set("gadget", gadgetNative);

    // link [block]
    // Create connections between gadgets
    context.set("link", linkNative);
}
