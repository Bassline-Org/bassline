import { Emits, Implements } from "../core/context";
import { PartialFunction, Valued } from "../core/protocols";


export function onChange<T>(source: Implements<Valued<T>>, callback: (value: T) => void) {
    return source.tap(({ changed }) => {
        if (changed !== undefined) {
            callback(changed);
        }
    });
}

export function onComputed<T>(source: Emits<{ computed: T }>, callback: (value: T) => void) {
    return source.tap(({ computed }) => {
        if (computed !== undefined) {
            callback(computed);
        }
    });
}