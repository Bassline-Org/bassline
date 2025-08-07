// Example usage of the type-safe serialization system

import { serialize, deserialize, createSerializer } from './serialization'
import type { Contact, Group, Serializable } from './types'
import { brand } from './types'

// ============================================================================
// Basic Usage Examples
// ============================================================================

// Example 1: Serializing a contact
const myContact: Contact = {
  id: brand.contactId('contact-1'),
  groupId: brand.groupId('group-1'),
  content: 'Hello World',
  blendMode: 'accept-last',
  name: 'Input'
}

// Type-safe serialization
const contactJson = serialize.contact(myContact)
console.log('Serialized contact:', contactJson)

// Type-safe deserialization with error handling
const contactResult = deserialize.contact(contactJson)
if (contactResult.ok) {
  console.log('Deserialized contact:', contactResult.value)
} else {
  console.error('Failed to deserialize:', contactResult.error)
}

// ============================================================================
// Custom Type Serialization
// ============================================================================

interface UserData {
  name: string
  age: number
  tags: string[]
}

// Create a custom serializer
const userSerializer = createSerializer<UserData>()

const userData: UserData = {
  name: 'Alice',
  age: 30,
  tags: ['developer', 'designer']
}

const userJson = userSerializer.serialize(userData)
const userResult = userSerializer.deserialize(userJson)

// ============================================================================
// Type Safety Examples
// ============================================================================

// This would cause a TypeScript error - functions can't be serialized
// const badData = {
//   name: 'Test',
//   action: () => console.log('hello')  // Function - not serializable!
// }
// serialize.json(badData)  // TypeScript Error: Type '() => void' is not assignable to type 'never'

// Safe serialization handles non-serializable types gracefully
const mixedData = {
  name: 'Test',
  action: () => console.log('hello'),
  symbol: Symbol('test'),
  value: undefined
}

// This replaces non-serializable values with placeholders
const safeJson = serialize.safe(mixedData)
console.log('Safe serialization:', safeJson)
// Output: {"name":"Test","action":"[Function]","symbol":"[Symbol]","value":"[Undefined]"}

// ============================================================================
// Network State Serialization
// ============================================================================

// Complex state with Maps gets properly serialized/deserialized
const networkState = {
  groups: new Map([
    ['group-1', {
      group: {
        id: brand.groupId('group-1'),
        name: 'Main Group',
        contactIds: [],
        wireIds: [],
        subgroupIds: [],
        boundaryContactIds: []
      },
      contacts: new Map(),
      wires: new Map()
    }]
  ]),
  currentGroupId: 'group-1',
  rootGroupId: 'group-1'
}

const stateJson = serialize.networkState(networkState)
const stateResult = deserialize.networkState(stateJson)

if (stateResult.ok) {
  console.log('Successfully deserialized network state')
  // The Maps are properly reconstructed
  const group = stateResult.value.groups.get('group-1')
  console.log('Group name:', group?.group.name)
}

// ============================================================================
// Validation Examples
// ============================================================================

// Deserializing invalid JSON
const invalidContactJson = JSON.stringify({
  id: 'contact-1',
  // Missing required fields: groupId, blendMode
})

const invalidResult = deserialize.contact(invalidContactJson)
if (!invalidResult.ok) {
  console.error('Validation failed:', invalidResult.error.message)
  // Output: "Invalid Contact: missing required fields"
}

// ============================================================================
// Display Formatting
// ============================================================================

// Format various types for display
console.log(serialize.display(null))        // "null"
console.log(serialize.display(undefined))   // "undefined"
console.log(serialize.display("text"))      // "text"
console.log(serialize.display(42))          // "42"
console.log(serialize.display({ a: 1 }))    // "{\n  \"a\": 1\n}"

// Check if string is valid JSON
console.log(deserialize.isValid('{"valid": true}'))  // true
console.log(deserialize.isValid('not json'))          // false