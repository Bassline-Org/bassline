import { NativeFn } from "../datatypes/functions.js";

export default {
    "type?": new NativeFn(
        ["value"],
        ([value], _context) => value.getType(),
    ),
    "make": new NativeFn(
        [":type"],
        ([type], stream, context) => {
            const spelling = type.spelling;
            const datatype = context.get(spelling);
            return datatype.aClass.make(stream, context);
        },
    ),
};
