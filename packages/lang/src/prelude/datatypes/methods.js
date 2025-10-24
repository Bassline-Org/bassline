// import * as t from "./core.js";
// import { TYPES } from "./types.js";
// import { normalize } from "../../utils.js";
// import { method } from "../../method.js";
// import { bind } from "./types.js";
// import { nativeFn, nativeMethod } from "./functions.js";

// //== Function Creators ==//
// export const spec = (args) => {
//     return args.map((arg) => {
//         if (arg.startsWith(":")) {
//             return t.getWord(arg.slice(1));
//         }
//         if (arg.startsWith("'")) {
//             return t.litWord(arg.slice(1));
//         }
//         return t.word(arg);
//     });
// };

// export const nativeFn = (fnSpec, body) => {
//     return t.nativeFn({
//         spec: spec(fnSpec),
//         body,
//     });
// };

// export const nativeMethod = (methodSpec, method) => {
//     return t.nativeMethod({
//         spec: spec(methodSpec),
//         body: method,
//     });
// };

// export const fn = (args, body, parent) => {
//     const ctx = t.fn(new Map());
//     bind(ctx, t.word("self"), ctx);
//     if (parent) {
//         bind(ctx, t.word("parent"), parent);
//     }
//     bind(ctx, t.word("args"), args);
//     bind(ctx, t.word("body"), body);
//     return ctx;
// };
