import { 
  createAdder,
  propagate,
  signal,
  formatStrength
} from './src'

const adder = createAdder('test-add')
const a = adder.contacts.get('a')!
const b = adder.contacts.get('b')!
const output = adder.contacts.get('output')!

console.log('Debug Adder\n')

console.log('Initial:')
console.log('  A:', a.signal)
console.log('  B:', b.signal)
console.log('  Output:', output.signal)

console.log('\nSetting A to 5:')
propagate(a, signal(5, 0.9))
console.log('  A:', a.signal)
console.log('  Output:', output.signal)

console.log('\nSetting B to 3:')
propagate(b, signal(3, 0.4))
console.log('  A:', a.signal)
console.log('  B:', b.signal)
console.log('  Output:', output.signal)

console.log('\nExpected: value=8, strength=4000 (MIN of 9000 and 4000)')