import { createGadget } from '../core';
import { noop } from '../effects';

export * as cells from './cells';
export * as functions from './functions';

// A constant gadget
export const constant = <T>(value: T) => {
    return createGadget((_current: T, _incoming: any) => 'ignore')({
        'ignore': (_gadget, _current, _incoming) => noop(),
    })(value);
}