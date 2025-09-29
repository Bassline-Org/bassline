import _ from "lodash";

type MultiMethods<D extends (...args: any[]) => Key, Key extends PropertyKey, Result> = {
    dispatch: D,
    key: Key,
    result: Result,
    args: Parameters<D>,
    methods: { [K in Key]: (...args: Parameters<D>) => Result }
}

export const defMulti = <D extends (...args: any[]) => any, Result>(dispatch: D) => {
    type Info = MultiMethods<D, ReturnType<D>, Result>;
    function call(...args: Info['args']) {
        const key = dispatch(...args);
        const method = call.methods[key as Info['key']];
        if (method) {
            return method(...args);
        }
        console.warn(`defMulti: Missing method for key "${key}"`);
        return undefined;
    }
    call.defMethods = <M extends { [K in Info['key']]: (...args: Info['args']) => any }>(m: M) => {
        for (const key in m) {
            const fn = m[key];
            call.methods[key as Info['key']] = fn as Info['methods'][Info['key']];
        }
    }
    call.methods = {} as Info['methods'];
    call.derive = () => {
        const multi = defMulti(_.cloneDeep(dispatch))
        type M = typeof multi.methods;
        multi.methods = multi.methods as M;
        return multi;
    }
    call.freeze = () => {
        return Object.freeze(call);
    }
    return call;
}

function test() {
    const foo = defMulti((a: number, b: number) => {
        if (a > b) return 'gt';
        if (a < b) return 'lt';
        return 'eq';
    })

    foo.defMethods({
        'eq': (_a, _b) => 69,
        'gt': (a, b) => a - b,
        'lt': (a, b) => a + b,
    })

    const frozen = foo.freeze();

    console.log(foo(1, 2))
    console.log(foo(2, 1))
    console.log(foo(1, 1))
}