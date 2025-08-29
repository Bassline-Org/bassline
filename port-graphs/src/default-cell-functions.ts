import { JsonValue } from "./types"

export interface CellFunction {
    name: string
    fn: (current: JsonValue | undefined, incoming: JsonValue) => JsonValue
}

export const defaultCellFunctions: CellFunction[] = [
    {
        name: 'max',
        fn: (current: JsonValue | undefined, incoming: JsonValue) => {
            if (typeof current === 'number' && typeof incoming === 'number') {
                return current === undefined ? incoming : Math.max(current, incoming)
            }
            return incoming
        }
    },
    {
        name: 'min',
        fn: (current: JsonValue | undefined, incoming: JsonValue) => {
            if (typeof current === 'number' && typeof incoming === 'number') {
                return current === undefined ? incoming : Math.min(current, incoming)
            }
            return incoming
        }
    },
    {
        name: 'union',
        fn: (current: JsonValue | undefined, incoming: JsonValue) => {
            if (Array.isArray(current) && Array.isArray(incoming)) {
                return [...new Set([...current, ...incoming])]
            }
            return incoming
        }
    }
]
