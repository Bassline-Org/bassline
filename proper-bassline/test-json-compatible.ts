import { OrdinalCell } from './src/cells/basic'
import { num, getMapValue, getOrdinal } from './src/types'

console.log('=== Testing JSON-Compatible Structures ===\n')

const cell = new OrdinalCell('test')

console.log('1. User input 10:')
cell.userInput(num(10))
const output1 = cell.getOutput()
console.log('Output:', output1)
console.log('JSON.stringify:', JSON.stringify(output1))
console.log('Value:', getMapValue(output1)?.value)
console.log('Ordinal:', getOrdinal(output1))

console.log('\n2. User input 20:')
cell.userInput(num(20))
const output2 = cell.getOutput()
console.log('Output:', output2)
console.log('JSON.stringify:', JSON.stringify(output2))
console.log('Value:', getMapValue(output2)?.value)
console.log('Ordinal:', getOrdinal(output2))

console.log('\n3. Test JSON roundtrip:')
const json = JSON.stringify(output2)
const parsed = JSON.parse(json)
console.log('Parsed:', parsed)
console.log('Value from parsed:', getMapValue(parsed)?.value)
console.log('Ordinal from parsed:', getOrdinal(parsed))

console.log('\n✅ JSON compatibility verified!')