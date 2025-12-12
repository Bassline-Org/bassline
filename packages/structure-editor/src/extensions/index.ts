// Core JSON structure nodes
export { JsonDocument } from './JsonDocument'
export { JsonObject, type JsonObjectOptions } from './JsonObject'
export { JsonArray, type JsonArrayOptions } from './JsonArray'
export { JsonPair, type JsonPairOptions } from './JsonPair'
export { JsonElement, type JsonElementOptions } from './JsonElement'
export { JsonKey, type JsonKeyOptions } from './JsonKey'
export { JsonValue, type JsonValueOptions } from './JsonValue'
export { JsonPrimitive, type JsonPrimitiveOptions, type PrimitiveType } from './JsonPrimitive'

// Command system
export { CommandPrefix, type CommandPrefixOptions } from './CommandPrefix'

// Re-export Tiptap essentials for convenience
export { Extension, Node, Mark } from '@tiptap/core'
