import { linkNative } from "../dialects/link.js";

export function installDialects(context) {
    // link [block]
    // Create connections between gadgets
    context.set("link", linkNative);
}
