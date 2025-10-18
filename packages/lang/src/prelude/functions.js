import { NativeFn } from "../datatypes/functions";

export default {
    fn: new NativeFn(
        ["args", "body"],
        ([args, body], _context) => new Fn(args, body),
    ),
};
