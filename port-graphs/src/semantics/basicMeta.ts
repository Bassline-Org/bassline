import _ from "lodash";
import { createGadget } from "../core";
import { changed, noop } from "../effects";

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