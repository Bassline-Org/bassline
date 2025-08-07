// Type-safe Serialization System

import type { 
  Contact, 
  Group,
  GroupState, 
  Wire, 
  NetworkState, 
  Result,
  ContactId,
  GroupId,
  WireId
} from './types'
import { brand } from './types'

// ============================================================================
// Serializer Interface
// ============================================================================

// Types that cannot be serialized
export type NonSerializable = Function | symbol | undefined

// Helper type to exclude non-serializable types
export type Serializable<T> = T extends NonSerializable ? never : T

// Type-safe serializer interface
export interface Serializer<T> {
  serialize: (value: Serializable<T>) => string
  deserialize: (json: string) => Result<T, Error>
}

// Create a basic type-safe serializer
export function createSerializer<T>(): Serializer<T> {
  return {
    serialize: (value: Serializable<T>): string => {
      // Check for non-serializable types at runtime
      if (typeof value === 'function') {
        throw new Error('Cannot serialize functions')
      }
      if (typeof value === 'symbol') {
        throw new Error('Cannot serialize symbols')
      }
      if (value === undefined) {
        throw new Error('Cannot serialize undefined')
      }
      return JSON.stringify(value, null, 2)
    },
    deserialize: (json: string): Result<T, Error> => {
      try {
        return { ok: true, value: JSON.parse(json) as T }
      } catch (error) {
        return { ok: false, error: error as Error }
      }
    }
  }
}

// ============================================================================
// Serialize Namespace - Convert to JSON
// ============================================================================

export const serialize = {
  // Type-safe serializers for core types
  contact: (contact: Contact): string => {
    return JSON.stringify(contact, null, 2)
  },
  
  group: (group: Group): string => {
    return JSON.stringify(group, null, 2)
  },
  
  wire: (wire: Wire): string => {
    return JSON.stringify(wire, null, 2)
  },
  
  groupState: (state: GroupState): any => {
    // Handle Map serialization for GroupState - returns object for JSONB
    return {
      group: state.group,
      contacts: Array.from(state.contacts.entries()),
      wires: Array.from(state.wires.entries())
    }
  },
  
  networkState: (state: NetworkState): any => {
    // Handle Map serialization - returns object for JSONB
    return {
      ...state,
      groups: Array.from(state.groups.entries()).map(([id, groupState]) => ({
        id,
        group: groupState.group,
        contacts: Array.from(groupState.contacts.entries()),
        wires: Array.from(groupState.wires.entries())
      }))
    }
  },
  
  // Generic serialization with type safety - returns object for JSONB
  any: <T>(value: Serializable<T>): any => {
    // Runtime validation
    if (typeof value === 'function' || typeof value === 'symbol' || value === undefined) {
      throw new Error(`Cannot serialize ${typeof value}`)
    }
    return value // Return as-is for JSONB
  },
  
  json: <T>(value: Serializable<T>): string => {
    // Runtime validation
    if (typeof value === 'function' || typeof value === 'symbol' || value === undefined) {
      throw new Error(`Cannot serialize ${typeof value}`)
    }
    return JSON.stringify(value, null, 2)
  },
  
  compact: <T>(value: Serializable<T>): string => {
    if (typeof value === 'function' || typeof value === 'symbol' || value === undefined) {
      throw new Error(`Cannot serialize ${typeof value}`)
    }
    return JSON.stringify(value)
  },
  
  // Safe serialization that handles circular references and invalid types
  safe: <T>(value: T): string => {
    const seen = new WeakSet()
    return JSON.stringify(value, (_key, val) => {
      // Skip non-serializable types
      if (typeof val === 'function') {
        return '[Function]'
      }
      if (typeof val === 'symbol') {
        return '[Symbol]'
      }
      if (val === undefined) {
        return '[Undefined]'
      }
      // Handle circular references
      if (val !== null && typeof val === 'object') {
        if (seen.has(val)) {
          return '[Circular]'
        }
        seen.add(val)
      }
      return val
    })
  },
  
  // Format for display
  display: (content: unknown): string => {
    if (content === null) return 'null'
    if (content === undefined) return 'undefined'
    if (typeof content === 'string') return content
    if (typeof content === 'number' || typeof content === 'boolean') {
      return String(content)
    }
    if (typeof content === 'object') {
      return JSON.stringify(content, null, 2)
    }
    return String(content)
  },
} as const

// ============================================================================
// Deserialize Namespace - Parse from JSON
// ============================================================================

export const deserialize = {
  // Type-safe deserializers for core types
  contact: (json: string): Result<Contact, Error> => {
    try {
      const obj = JSON.parse(json)
      // Validate required fields
      if (!obj.id || !obj.groupId || !obj.blendMode) {
        return { ok: false, error: new Error('Invalid Contact: missing required fields') }
      }
      // Ensure branded types
      const contact: Contact = {
        ...obj,
        id: brand.contactId(obj.id),
        groupId: brand.groupId(obj.groupId)
      }
      return { ok: true, value: contact }
    } catch (error) {
      return { ok: false, error: error as Error }
    }
  },
  
  group: (json: string): Result<Group, Error> => {
    try {
      const obj = JSON.parse(json)
      if (!obj.id || !obj.name) {
        return { ok: false, error: new Error('Invalid Group: missing required fields') }
      }
      const group: Group = {
        ...obj,
        id: brand.groupId(obj.id),
        parentId: obj.parentId ? brand.groupId(obj.parentId) : undefined,
        contactIds: (obj.contactIds || []).map(brand.contactId),
        wireIds: (obj.wireIds || []).map(brand.wireId),
        subgroupIds: (obj.subgroupIds || []).map(brand.groupId),
        boundaryContactIds: (obj.boundaryContactIds || []).map(brand.contactId)
      }
      return { ok: true, value: group }
    } catch (error) {
      return { ok: false, error: error as Error }
    }
  },
  
  wire: (json: string): Result<Wire, Error> => {
    try {
      const obj = JSON.parse(json)
      if (!obj.id || !obj.groupId || !obj.fromId || !obj.toId) {
        return { ok: false, error: new Error('Invalid Wire: missing required fields') }
      }
      const wire: Wire = {
        ...obj,
        id: brand.wireId(obj.id),
        groupId: brand.groupId(obj.groupId),
        fromId: brand.contactId(obj.fromId),
        toId: brand.contactId(obj.toId),
        type: obj.type || 'bidirectional'
      }
      return { ok: true, value: wire }
    } catch (error) {
      return { ok: false, error: error as Error }
    }
  },
  
  groupState: (obj: any): GroupState => {
    // Reconstruct Map structures from JSONB object
    const contacts = new Map<ContactId, Contact>(obj.contacts)
    const wires = new Map<WireId, Wire>(obj.wires)
    
    return {
      group: obj.group,
      contacts,
      wires
    }
  },
  
  networkState: (obj: any): NetworkState => {
    // Reconstruct Map structures from JSONB object
    const groups = new Map<GroupId, GroupState>()
    for (const groupData of obj.groups) {
      const contacts = new Map<ContactId, Contact>(groupData.contacts)
      const wires = new Map<WireId, Wire>(groupData.wires)
      groups.set(groupData.id as GroupId, {
        group: groupData.group,
        contacts,
        wires
      })
    }
    
    return {
      groups,
      currentGroupId: obj.currentGroupId,
      rootGroupId: obj.rootGroupId
    }
  },
  
  // Generic deserialization
  any: <T>(jsonOrObj: string | any): T => {
    if (typeof jsonOrObj === 'string') {
      return JSON.parse(jsonOrObj) as T
    }
    return jsonOrObj as T
  },
  
  json: <T>(json: string): Result<T, Error> => {
    try {
      return { ok: true, value: JSON.parse(json) as T }
    } catch (error) {
      return { ok: false, error: error as Error }
    }
  },
  
  // Check if a string is valid JSON
  isValid: (json: string): boolean => {
    try {
      JSON.parse(json)
      return true
    } catch {
      return false
    }
  },
} as const

// ============================================================================
// Utility Functions
// ============================================================================

// Type-safe clone using serialization
export function cloneViaJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value))
}

// Create type-safe serializers for custom types
export function contactSerializer(): Serializer<Contact> {
  return {
    serialize: serialize.contact,
    deserialize: deserialize.contact
  }
}

export function groupSerializer(): Serializer<Group> {
  return {
    serialize: serialize.group,
    deserialize: deserialize.group
  }
}

export function wireSerializer(): Serializer<Wire> {
  return {
    serialize: serialize.wire,
    deserialize: deserialize.wire
  }
}

export function networkStateSerializer(): Serializer<NetworkState> {
  return {
    serialize: (state) => JSON.stringify(serialize.networkState(state)),
    deserialize: (json) => {
      try {
        const obj = JSON.parse(json)
        return { ok: true, value: deserialize.networkState(obj) }
      } catch (error) {
        return { ok: false, error: error as Error }
      }
    }
  }
}