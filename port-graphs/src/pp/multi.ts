type Fn<Args extends any[] = any[], T = any> = (...args: Args) => T;
type DispatchFn<T> = T extends Fn<any[], string | number | symbol> ? T : never;

export const defMulti = <D>(dispatch: D) => {
    type Disp = typeof dispatch extends DispatchFn<D> ? D : never;

    const d = dispatch as Disp;
    type Methods = {
        [K in ReturnType<typeof d>]:
        (...args: Parameters<typeof d>) => any extends (...args: Parameters<typeof d>) => infer R
            ? R : never;
    }

    const defMethod = (methods: Methods) => {
        return (...args: Parameters<typeof d>) => {
            const key = d(...args) as keyof Methods;
            const method = methods[key];
            return method(...args)
        }
    }
    return defMethod;
}