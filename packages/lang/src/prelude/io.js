import { NativeFn, NativeMethod } from "../datatypes/functions.js";
import { nil, Num, Str } from "../datatypes/core.js";
import { WebSocketServerHandle } from "../datatypes/io/index.js";

export default {
    /**
     * Open a resource and return a handle
     * For now, only supports WebSocket server
     *
     * Examples:
     *   open "ws-server://8080"           ; WebSocket server on port 8080
     */
    "open": new NativeFn(["resource"], ([resource], stream, context) => {
        const str = resource.value;

        // ws-server://port
        if (str.startsWith("ws-server://")) {
            const port = parseInt(str.slice(12));
            return new WebSocketServerHandle(new Num(port));
        }

        throw new Error(`Unknown resource type: ${str}`);
    }),

    /**
     * Write to a handle
     */
    "write": NativeMethod.binary("write"),

    /**
     * Close a handle
     */
    "close": NativeMethod.unary("close"),

    /**
     * Broadcast to all clients (for server handles)
     */
    "broadcast": NativeMethod.binary("broadcast"),
};
