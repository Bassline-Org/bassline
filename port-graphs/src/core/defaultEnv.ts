
var CURRENT_ENV: BaseEnv | null = null;
var ENV_STACK: BaseEnv[] = [];

export const current = () => ENV_STACK[ENV_STACK.length - 1]!;
export const bindings = () => current().bindings;
export const lookup = (name: string, ...args: unknown[]) => current().lookup(name, ...args);
export const def = (name: string, body: unknown, ...args: unknown[]) => current().def(name, body, ...args);
export const ref = (name: string, ...args: unknown[]) => current().ref(name, ...args);
export const set = (name: string, value: unknown, ...args: unknown[]) => current().set(name, value, ...args);
export const get = (name: string, ...args: unknown[]) => current().get(name, ...args);
export const call = (name: string, ...args: unknown[]) => current().call(name, ...args);
export const enter = (fn: (...args: unknown[]) => unknown, ...args: unknown[]) => current().enter(fn, ...args);

export const pushEnv = (env: BaseEnv) => ENV_STACK.push(env);
export const popEnv = () => ENV_STACK.pop();
export const parent = () => ENV_STACK[ENV_STACK.length - 2];
export const executeInParent = (fn: (...args: unknown[]) => unknown, ...args: unknown[]) => {
    const oldEnv = current();
    popEnv();
    try {
        return fn(...args);
    } finally {
        pushEnv(oldEnv);
    }
}


export interface BaseEnv {
    bindings: Record<string, unknown>;
    lookup: (name: string, ...args: unknown[]) => unknown;
    def: (name: string, body: unknown, ...args: unknown[]) => unknown;
    ref: (name: string, ...args: unknown[]) => unknown;
    set: (name: string, value: unknown, ...args: unknown[]) => unknown;
    get: (name: string, ...args: unknown[]) => unknown;
    call: (name: string, ...args: unknown[]) => unknown;
    enter: (fn: (...args: unknown[]) => unknown, ...args: unknown[]) => unknown;
}

export const DefaultEnvironment = {
    bindings: {},
    lookup: (name: string) => {
        const binding = bindings()[name];
        if (!binding && parent()) {
            return executeInParent(() => lookup(name));
        }
        return ref(name);
    },
    def: (name: string, body: unknown): unknown => {
        bindings()[name] = body;
        return body
    },
    ref: (name: string) => {
        return bindings()[name];
    },
    set: (name: string, value: unknown) => {
        bindings()[name] = value;
        return value;
    },
    get: (name: string) => {
        return bindings()[name];
    },
    call: (name: string, ...args: unknown[]) => {
        const bound = lookup(name);
        if(!bound) {
            throw new Error(`Unbound function: ${name}`);
        }
        if(typeof bound !== 'function' || !bound['apply']) {
            throw new Error(`Bound value is not a function: ${name}`);
        }
        return bound['apply'](null, args);
    },
    enter: (fn: (...args: unknown[]) => unknown, ...args: unknown[]) => {
        return fn.apply(null, args);
    }
}

export type DefaultEnv = typeof DefaultEnvironment & BaseEnv;

pushEnv(DefaultEnvironment);

enter(() => {
    const add = def('add', (...args: number[]) => args.reduce((a, b) => a + b, 0));
    const sub = def('subtract', (...args: number[]) => args.reduce((a, b) => a - b, 0));
    const mul = def('multiply', (...args: number[]) => args.reduce((a, b) => a * b, 1));
    const div = def('divide', (...args: number[]) => args.reduce((a, b) => a / b, 1));

    const a = set('a', 1);
    const b = set('b', 2);
    console.log(call('add', 1, 2));
    console.log(call('subtract', 1, 2));
    console.log(get('a'));
    console.log('a = ', a);
    console.log('b = ', b);
    console.log(get('b'));
});