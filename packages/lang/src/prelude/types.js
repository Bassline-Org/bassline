import { Method, NativeFn } from "../datatypes/index.js";

export default {
    "type?": Method.unary("getType"),
    "make": new NativeFn(
        [":type"],
        ([type], stream, context) => {
            const spelling = type.spelling;
            const datatype = context.get(spelling);
            return datatype.aClass.make(stream, context);
        },
    ),
};
