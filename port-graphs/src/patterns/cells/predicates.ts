import _ from "lodash";
import { createGadget } from "../../core";
import { changed } from "../../effects";

export const predicate = (fn: (value: any) => boolean) => {
  return createGadget<any, any>(
    (current, incoming) => {
      if (fn(incoming) && incoming !== current) {
        return { action: 'update', context: { value: incoming } };
      }
      return null; // Predicate failed or no change
    },
    {
      'update': (gadget, { value }) => {
        gadget.update(value);
        return changed(value);
      }
    }
  );
};

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