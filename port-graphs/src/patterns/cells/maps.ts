import { createGadget } from "../../core";
import _ from "lodash";
import { changed, noop } from "../../effects";

export const clean = (...objs: Record<string, any>[]) => objs.map(x => _.omitBy(x, _.isNil));
export const mapDispatch = <K extends string, V>(current: Record<K, V>, incoming: Partial<typeof current>) => {
    return _.cond([
        [() => !_.isPlainObject(incoming), () => 'ignore'],
        [() => _.isEmpty(incoming), () => 'ignore'],
        [() => _.isEqual(incoming, current), () => 'ignore'],
        [() => true, () => 'merge']
    ])()
}

export function createMap<D extends (current: Record<string, any>, incoming: Partial<typeof current>) => string>(dispatch: D) {
    return createGadget(dispatch)
}

export const firstMap = createMap(mapDispatch)({
    'merge': (gadget, current, incoming) => {
        const [cleanedCurrent, cleanedIncoming] = clean(current, incoming);
        const result = { ...cleanedIncoming, ...cleanedCurrent };
        gadget.update(result);
        return changed(result);
    },
    'ignore': (_gadget, _current, _incoming) => {
        return noop();
    }
});

export const lastMap = createMap(mapDispatch)({
    'merge': (gadget, current, incoming) => {
        const [cleanedCurrent, cleanedIncoming] = clean(current, incoming);
        const result = { ...cleanedCurrent, cleanedIncoming };
        gadget.update(result);
        return changed(result);
    },
    'ignore': (_gadget, _current, _incoming) => {
        return noop();
    }
})

export const unionMap = createMap(mapDispatch<string, any[]>)({
    'merge': (gadget, current, incoming) => {
        const [cleanedCurrent, cleanedIncoming] = clean(current, incoming);
        const result = _.mergeWith(cleanedCurrent, cleanedIncoming, (a: any[], b: any[]) => {
            return _.union(a, b);
        });
        if (result) {
            gadget.update(result);
            return changed(result);
        }
        return noop();
    },
    'ignore': (_gadget, _current, _incoming) => {
        return noop();
    }
})

const foo = firstMap({ a: 1, b: 2 });
foo.receive({ c: 3 });
foo.receive({ c: 5 });
console.log('c should be 3:', foo.current());

const bar = lastMap({ a: 1, b: 2 });
bar.receive({ c: 3 });
bar.receive({ c: 5 });
console.log('c should be 5:', bar.current());

const baz = unionMap({ a: [1, 2], b: [3, 4] });
baz.receive({ c: [5, 6] });
baz.receive({ c: [7, 8] });
console.log('c should be [5, 6, 7, 8]:', baz.current());