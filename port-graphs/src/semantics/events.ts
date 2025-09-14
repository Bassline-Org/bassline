import _ from "lodash";
import { adder } from "../patterns/functions/numeric";
import { extendGadget } from "./index";
import { clean } from "../patterns/cells/maps";

// function addEventEmitter<G>(g: G) {
//     extendGadget(g)((effect) => {
//         const [kind, ...args] = effect;
//         if (kind === 'changed') {
//             const [{ result: value, ...rest }] = args;
//             if (value !== undefined) {
//                 emitter.dispatchEvent(new CustomEvent('change', { detail: value }));
//             }
//         }
//     });
//     return g;
// };

// const foo = adder({ a: 0, b: 0 });
// const extend = extendGadget(foo);
// extend((effect) => {
//     if (_.isMatch(effect, ['changed', {}])) {
//         console.log('Changed bruh: ', effect)
//     }

//     if (_.isMatch(effect, ['noop'])) {
//         console.log('Noop bruh: ', effect)
//     }
// });

// foo.receive({ a: 50, b: 20 });
// foo.receive({ a: 50, b: 20 });