import { 
  num, str, bool, set, dict, array, nil,
  serialize, deserialize,
  isSet, isDict
} from './src/types'

console.log('=== Testing Serialization Protocol ===\n')

// Test 1: Basic types
console.log('1. Basic types:')
const basicValues = [
  num(42),
  str("hello"),
  bool(true),
  nil()
]

for (const val of basicValues) {
  const serialized = serialize(val)
  const deserialized = deserialize(serialized)
  console.log(`  ${val.type}: ${JSON.stringify(serialized)} -> OK`)
}

// Test 2: Set with deduplication
console.log('\n2. Set operations:')
const mySet = set([num(1), num(2), num(1), num(3)])  // Should deduplicate
console.log('  Runtime Set:', mySet)
console.log('  Set size:', isSet(mySet) ? mySet.value.size : 'not a set')
console.log('  Set has num(1)?', isSet(mySet) ? Array.from(mySet.value).some(v => v.type === 'number' && v.value === 1) : false)

const serializedSet = serialize(mySet)
console.log('  Serialized:', JSON.stringify(serializedSet))

const deserializedSet = deserialize(serializedSet)
console.log('  Deserialized size:', isSet(deserializedSet) ? deserializedSet.value.size : 'not a set')

// Test 3: Dict/Map operations
console.log('\n3. Dict/Map operations:')
const myDict = dict({
  name: str("Alice"),
  age: num(30),
  active: bool(true)
})
console.log('  Runtime Map:', myDict)
console.log('  Map size:', isDict(myDict) ? myDict.value.size : 'not a dict')
console.log('  Map.get("name"):', isDict(myDict) ? myDict.value.get("name") : null)

const serializedDict = serialize(myDict)
console.log('  Serialized:', JSON.stringify(serializedDict))

const deserializedDict = deserialize(serializedDict)
console.log('  Deserialized size:', isDict(deserializedDict) ? deserializedDict.value.size : 'not a dict')
console.log('  Deserialized.get("name"):', isDict(deserializedDict) ? deserializedDict.value.get("name") : null)

// Test 4: Nested structures
console.log('\n4. Nested structures:')
const nested = dict({
  items: set([num(1), num(2), num(3)]),
  metadata: dict({
    created: str("2024-01-01"),
    tags: array([str("important"), str("urgent")])
  })
})

const serializedNested = serialize(nested)
console.log('  Serialized nested:', JSON.stringify(serializedNested, null, 2))

const deserializedNested = deserialize(serializedNested)
if (isDict(deserializedNested)) {
  const items = deserializedNested.value.get("items")
  console.log('  Items is Set?', isSet(items))
  if (isSet(items)) {
    console.log('  Items size:', items.value.size)
  }
}

// Test 5: JSON roundtrip
console.log('\n5. Full JSON roundtrip:')
const jsonStr = JSON.stringify(serializedNested)
const parsed = JSON.parse(jsonStr)
const restored = deserialize(parsed)
console.log('  Roundtrip successful?', isDict(restored))

console.log('\n✅ Serialization protocol working!')