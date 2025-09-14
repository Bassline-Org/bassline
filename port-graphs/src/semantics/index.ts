import _ from "lodash";
import { adder } from "../patterns/functions";
import { GadgetDetails } from "./manualWires";

export function extendGadget<G>(gad: G) {
    type Details = GadgetDetails<G>;
    const gadget = gad as Details;
    return function extend(emit: Details['emit']) {
        const oldEmit = gadget.emit;
        gadget.emit = (effect) => {
            emit(effect);
            oldEmit(effect);
        }
        return extend;
    }
}