import _ from "lodash";

type Fn<Args extends any[] = any[], T = any> = (...args: Args) => T;
type DispatchFn<T> = T extends Fn<any[], string | number | symbol> ? T : never;

export const defMulti = <D>(dispatch: D) => {
    type Disp = typeof dispatch extends DispatchFn<D> ? D : never;
    const d = dispatch as Disp;
    const methods = {} as { [K in ReturnType<typeof d>]: (...args: Parameters<typeof d>) => any };

    function call(...args: Parameters<typeof d>) {
        const key = d(...args);
        const method = methods[key as ReturnType<typeof d>];
        if (method) {
            return method(...args);
        }
        return undefined;
    }
    call.defMethods = (m: { [K in ReturnType<typeof d>]: (...args: Parameters<typeof d>) => any }) => {
        for (const [key, value] of Object.entries(m)) {
            methods[key as ReturnType<typeof d>] = value as (...args: Parameters<typeof d>) => any;
        }
    }
    call.derive = () => {
        return defMulti(_.cloneDeep(dispatch))
    }
    return call;
}

// function test() {
//     const foo = defMulti((a: number, b: number) => {
//         if (a > b) return 'gt';
//         if (a < b) return 'lt';
//         return 'eq';
//     })

//     foo.defMethods({
//         'eq': (_a, _b) => 69,
//         'gt': (a, b) => a - b,
//         'lt': (a, b) => a + b,
//     })

//     console.log(foo(1, 2))
//     console.log(foo(2, 1))
//     console.log(foo(1, 1))
// }