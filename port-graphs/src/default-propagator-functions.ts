import { JsonValue } from "./types"

export interface PropagatorFunction {
    name: string
    fn: (...args: JsonValue[]) => JsonValue
}

export const defaultPropagatorFunctions: PropagatorFunction[] = [
    {
        name: 'add',
        fn: (a: JsonValue, b: JsonValue) => {
            if (typeof a === 'number' && typeof b === 'number') {
                return a + b
            }
            return 0
        }
    },
    {
        name: 'multiply',
        fn: (a: JsonValue, b: JsonValue) => {
            if (typeof a === 'number' && typeof b === 'number') {
                return a * b
            }
            return 0
        }
    },
    {
        name: 'or',
        fn: (a: JsonValue, b: JsonValue) => {
            if (typeof a === 'boolean' && typeof b === 'boolean') {
                return a || b
            }
            return false
        }
    },
    {
        name: 'and',
        fn: (a: JsonValue, b: JsonValue) => {
            if (typeof a === 'boolean' && typeof b === 'boolean') {
                return a && b
            }
            return false
        }
    },
    {
        name: 'concat',
        fn: (a: JsonValue, b: JsonValue) => {
            if (typeof a === 'string' && typeof b === 'string') {
                return a + b
            }
            return String(a) + String(b)
        }
    }
]
