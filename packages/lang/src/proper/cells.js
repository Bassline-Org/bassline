import { normalize } from "./spelling.js";
/**
 * An "enum" that lists off every type of cell in the system
 */
export const TYPE = {
    NONE: 0,
    NUMBER: 1,
    WORD: 2,
};

export class ReCell {
    constructor(type, props) {
        this.type = type;
        Object.assign(this, props);
        Object.freeze(this);
    }
}

export const make = {
    num(number = 0) {
        return new ReCell(TYPE.NUMBER, { value: number });
    },
    word(spelling, binding) {
        return new ReCell(TYPE.WORD, {
            spelling: normalize(spelling),
            binding,
        });
    },
};
