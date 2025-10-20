import { NativeFn, NativeMethod } from "../datatypes/index.js";

export default {
    "type?": NativeMethod.unary("getType"),
    "make": new NativeFn(
        ["'type"],
        ([type], stream, context) => {
            const spelling = type.spelling;
            const datatype = context.get(spelling);
            if (!datatype) {
                throw new Error("Unknown datatype! ", spelling, context);
            }
            return datatype.value.make(stream, context);
        },
    ),
};
