import _ from "lodash";
import { createGadget } from "../core";
import { changed, noop } from "../effects";
import { maxCell } from "../patterns/cells";
import { wires } from "./manualWires";
import { adder } from "../patterns/functions";

export type Tagged<K extends string, V> = {
    [key in K]: V;
}

export const getter = (tag: string) => createGadget(
    (current: any, incoming: any) => {
        return _.cond([
            [() => _.isPlainObject(incoming) && _.isEqual(incoming, current), () => 'ignore'],
            [() => _.isPlainObject(incoming) && _.has(incoming, tag), () => 'extract'],
            [() => true, () => 'ignore']
        ])();
    })({
        'extract': (gadget, _current, incoming) => {
            const value = incoming[tag];
            gadget.update(value);
            return changed(value);
        },
        'ignore': () => noop()
    })(undefined);

export const pair = <T extends string>(tag: T) => createGadget(
    (current: Tagged<T, any>, incoming: any) => {
        return _.cond([
            [() => _.isPlainObject(incoming) && incoming[tag] === current[tag], _.constant('ignore')],
            [() => current[tag] === incoming, _.constant('ignore')],
            [_.stubTrue, _.constant('tag')]
        ])();
    })({
        'tag': (gadget, _current, incoming) => {
            const value = incoming[tag] || incoming;
            const taggedValue = { [tag]: value } as Tagged<T, any>;
            gadget.update(taggedValue);
            return changed(taggedValue);
        },
        'ignore': () => noop()
    })({ [tag]: undefined } as Tagged<T, any>);

const source = maxCell(0);

const aTagger = pair('a');

const bTagger = pair('b');

const add = adder({});

const get = getter('result');

const dump = maxCell(0);


wires.directed(source, aTagger);
wires.directed(source, bTagger);

wires.directed(aTagger, add);
wires.directed(bTagger, add);
wires.directed(add, get);
wires.directed(get, dump);

source.receive(10);
source.receive(20);
source.receive(30);

console.log(dump.current());