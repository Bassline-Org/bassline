
export function defMulti<TArgs extends any[], TReturn extends string | number | symbol>(
    dispatch: (...args: TArgs) => TReturn,
) {
    type BodyFn = (...args: TArgs & {length: TArgs['length']}) => any;
    const action = {} as Record<TReturn, BodyFn>;

    const defMethods = <TEffects extends Record<TReturn, BodyFn>>(
        methods: TEffects
    ) => {
        for (const [key, fn] of Object.entries(methods) as [TReturn, BodyFn][]) {
            action[key] = fn;
        }
        
        function call(...args: TArgs): ReturnType<TEffects[keyof TEffects]> {
            const key = dispatch(...args);
            const fn = action[key] || action['default' as TReturn];
            if (!fn) {
                throw new Error(`No method or default for key: ${key.toString()}`);
            }
            return fn(...args) as ReturnType<TEffects[keyof TEffects]>;
        }
        
        return call;
    };

    function call(...args: TArgs): ReturnType<BodyFn> {
        const key = dispatch(...args);
        const fn = action[key] || action['default' as TReturn];
        if (!fn) {
            throw new Error(`No method or default for key: ${key.toString()}`);
        }
        return fn(...args);
    };

    call.defMethods = defMethods;
    return call;
}