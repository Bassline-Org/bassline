type Env = Record<string, Function>;

var CURRENT_ENV = null;
var ENV_STACK: Env[] = [];

function current() { return ENV_STACK[ENV_STACK.length - 1]!; }
function push(env: Env) { ENV_STACK.push(env); }
function pop() { return ENV_STACK.pop(); }
function executeInParent(fn: () => any) {
    const oldEnv = current()!;
    pop();
    try {
        return fn();
    } finally {
        push(oldEnv);
    }
}

function executeInEnv<R>(env: Env, fn: () => R) {
    push(env);
    try {
        return fn();
    } finally {
        pop();
    }
}

const ExampleEnv = {
    lookup: (name: string, ...args: any[]) => {
        const binding = current()[name];
        if (!binding) {
            return executeInParent(() => lookup(name));
        }
        return binding;
    },
    def: (name: string, body: any) => {
        current()[name] = body;
    },
    ref: (name: string) => {
        return current()[name];
    },
    foo: (...args: any[]) => {
        console.log('foo called with', args);
    }
}

const ChildEnv = {
    ...ExampleEnv,
    foo: (...args: any[]) => {
        console.log('child foo called with', args);
    }
};

function helpers<T extends Env>(env: T) {
    return {
        lookup: (name: keyof T) => {
            return env[name];
        },
    }
}

const ExampleHelpers = helpers(ExampleEnv);
ExampleHelpers.lookup('foo');

// ==============================
// Helper functions for interacting with the environment
// ==============================
function lookup(name: string, ...args: any[]): Function {
    return current()['lookup']!(name, ...args);
}

function call(name: string, ...args: any[]) {
    const fn = lookup(name, ...args);
    return fn(...args);
}

function def(name: string, body: any) {
    return call('def', name, body);
}

function ref(name: string) {
    return call('ref', name);
}

const exampleFn = () =>
    call('foo', 1, 2, 3);

executeInEnv(ExampleEnv, () => call('foo', 1, 2, 3));

executeInEnv(ChildEnv, () => exampleFn());

function something(foo: string, bar: number, baz: boolean) {
    return [1,2,3];
}

type Mode = 'direct' | 'staging' | 'tracing';
var CURRENT_MODE: Mode = 'direct';

class StagedValue {
    constructor(private raw: any) {}
    get mode() {
        return CURRENT_MODE;
    }
    [Symbol.toPrimitive](hint: 'number' | 'string' | 'default'): any {
        console.log(`toPrimitive called with hint: ${hint}`);
        
        switch (this.mode) {
            case 'direct':
                return this.raw;
                
            case 'staging':
                // Return a symbol or string representation for staging
                return `[staged:${this.raw}]`;
                
            case 'tracing':
                console.log(`Converting ${this.raw} to primitive (${hint})`);
                return this.raw;
                
            default:
                return this.raw;
        }
    }

}

const somethingProxy = new Proxy(something, {
    get(target, prop, receiver) {
        if (prop === 'name') {
            return 'idk man but i think it should be this';
        }
        return target[prop as keyof typeof target];
    },
    apply(target, thisArg, args) {
        if (args.length !== 3) {
            return target.apply(thisArg, args as Parameters<typeof target>);
        }
        return target.apply(thisArg, args as Parameters<typeof target>);
    },
})

const a = new StagedValue(1);
const b = new StagedValue(2);

console.log('a + b = ', a + b)