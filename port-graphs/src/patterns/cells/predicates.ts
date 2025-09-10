import _ from "lodash";
import { createGadget } from "../../core";
import { changed, noop } from "../../effects";

export const predicate = (fn: (value: any) => boolean) => {
    return createGadget((value: any) => {
        if (fn(value)) return 'true';
        return 'false';
    })({
        'true': (gadget, value) => {
            if (value === gadget.current()) return noop();
            gadget.update(value);
            return changed(value);
        },
        'false': (_gadget, _value) => noop()
    });
}

export const numberp = predicate((value: any) => _.isNumber(value));
export const stringp = predicate((value: any) => _.isString(value));
export const booleanp = predicate((value: any) => _.isBoolean(value));
export const arrayp = predicate((value: any) => _.isArray(value));
export const objectp = predicate((value: any) => _.isObject(value));
export const functionp = predicate((value: any) => _.isFunction(value));
export const nullp = predicate((value: any) => value === null);
export const undefinedp = predicate((value: any) => value === undefined);
export const symbolp = predicate((value: any) => _.isSymbol(value));
export const datep = predicate((value: any) => _.isDate(value));
export const errorp = predicate((value: any) => _.isError(value));