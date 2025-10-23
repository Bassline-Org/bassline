export type BValue<T extends BType, V> = {
    type: T;
    value: V
}

export type BType =
| "word"
| "get-word"
| "set-word"
| "lit-word"
| "context"
| "context-chain"
| "function"
| "native-function"
| "native-method"
| "block"
| "paren"
| "number"
| "string"

export type BValues = {
    "word": BValue<"word", Symbol>;
    "get-word": BValue<"get-word", Symbol>;
    "set-word": BValue<"set-word", Symbol>;
    "lit-word": BValue<"lit-word", Symbol>;
    "context": BValue<"context", Map<Symbol, BValue<any>>>;
    "context-chain": BValue<"context-chain", Map<Symbol, BValue<any>>>;
    "function": BValue<"function", BFunction>;
    "native-function": BValue<"native-function", BNativeFunction>;
    "native-method": BValue<"native-method", BNativeMethod>;
    "block": BValue<"block", BValue<any, any>[]>;
    "paren": BValue<"paren", BValue<any, any>[]>;
    "number": BValue<"number", number>;
    "string": BValue<"string", string>;
}

export function bind<T>(context: BValues['context'], key: BValue<"word", Symbol>, value: T): BValue<T, V>

export function doBlock(block: BValues['block' | 'paren'], context: BValues['context']): BValues[keyof BValues]