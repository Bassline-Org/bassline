import _ from "lodash";
import { createGadget } from "../../core";
import { changed, contradiction, noop } from "../../effects";

export const unionCell = createGadget((current: any[], incoming: any[]) => {
    if (incoming.length > current.length) return 'merge';
    if (_.isEmpty(_.difference(current, incoming))) return 'ignore';
    return 'merge';
})({
    'merge': (gadget, current, incoming) => {
        const result = _.union(current, incoming) as any[];
        if (_.difference(result, current).length > 0) {
            gadget.update(result);
            return changed(result);
        }
        return noop();
    },
    'ignore': (_gadget, _current, _incoming) => {
        return noop();
    }
});

export const differenceCell = createGadget((current: any[], incoming: any[]) => {
    if (_.isEmpty(_.difference(current, incoming))) return 'ignore';
    return 'merge';
})({
    'merge': (gadget, current, incoming) => {
        const result = _.difference(current, incoming) as any[];
        if (result.length > 0) {
            gadget.update(result);
            return changed(result);
        } else {
            return contradiction(current, incoming);
        }
    },
    'ignore': (_gadget, _current, _incoming) => {
        return noop();
    }
});

export const intersectionCell = createGadget((current: any[], incoming: any[]) => {
    const overlap = _.intersection(current, incoming);
    if (_.isEmpty(overlap)) return 'contradiction';
    if (overlap.length === current.length) return 'ignore';
    return 'merge';
})({
    'merge': (gadget, current, incoming) => {
        const result = _.intersection(current, incoming) as any[];
        if (result.length > 0) {
            gadget.update(result);
            return changed(result);
        } else {
            return contradiction(current, incoming);
        }
    },
    'ignore': (_gadget, _current, _incoming) => {
        return noop();
    },
    'contradiction': (_gadget, current, incoming) => {
        return contradiction(current, incoming);
    }
});
