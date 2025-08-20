/**
 * Demonstration of the type system with predicates, safe operations, and lists
 */

import {
  createGadget,
  createContact,
  createSignal,
  wire,
  propagate,
  Value
} from '../src'

import {
  createNumberP,
  createStringP,
  createArrayP,
  createContradictionP,
  createPairP
} from '../src/predicates'

import {
  createSafeAdd,
  createSafeConcat,
  createIntervalAdd
} from '../src/safe-primitives'

import {
  createCar,
  createCdr,
  createCons,
  createPair
} from '../src/list-ops'

import {
  tag,
  contradiction,
  isContradiction,
  stringify
} from '../src/tagged'

function runTests() {
  console.log('Atto-Bassline Type System Tests\n')
  console.log('=' .repeat(50))
  
  // Test 1: Type predicates
  console.log('\nTest 1: Type Predicates')
  {
    const numberChecker = createNumberP('num-check')
    const input = numberChecker.contacts.get('value')!
    const output = numberChecker.contacts.get('output')!
    
    propagate(input, createSignal(42, 1.0))
    console.log(`Is 42 a number? ${output.signal.value}`)
    
    propagate(input, createSignal("hello", 1.2))
    console.log(`Is "hello" a number? ${output.signal.value}`)
    
    propagate(input, createSignal([1, 2, 3], 1.4))
    console.log(`Is [1,2,3] a number? ${output.signal.value}`)
  }
  
  // Test 2: Safe operations with contradictions
  console.log('\n' + '=' .repeat(50))
  console.log('\nTest 2: Safe Operations & Contradictions')
  {
    const adder = createSafeAdd('safe-add')
    const a = adder.contacts.get('a')!
    const b = adder.contacts.get('b')!
    const output = adder.contacts.get('output')!
    
    // Valid addition
    propagate(a, createSignal(5, 0.9))
    propagate(b, createSignal(3, 0.4))
    console.log(`5 + 3 = ${stringify(output.signal.value)} (strength: ${output.signal.strength})`)
    
    // Type error
    propagate(a, createSignal("five", 0.9))
    propagate(b, createSignal(3, 0.4))
    const result = output.signal.value
    if (result && isContradiction(result)) {
      console.log(`Type error: ${(result as any).value.reason}`)
    }
  }
  
  // Test 3: List operations
  console.log('\n' + '=' .repeat(50))
  console.log('\nTest 3: List Operations')
  {
    const list = [1, 2, 3, 4, 5]
    
    // Car/Cdr
    const car = createCar('car')
    const carInput = car.contacts.get('list')!
    const carOutput = car.contacts.get('output')!
    
    propagate(carInput, createSignal(list, 1.0))
    console.log(`car([1,2,3,4,5]) = ${stringify(carOutput.signal.value)}`)
    
    const cdr = createCdr('cdr')
    const cdrInput = cdr.contacts.get('list')!
    const cdrOutput = cdr.contacts.get('output')!
    
    propagate(cdrInput, createSignal(list, 1.0))
    console.log(`cdr([1,2,3,4,5]) = ${stringify(cdrOutput.signal.value)}`)
    
    // Cons
    const cons = createCons('cons')
    const consHead = cons.contacts.get('head')!
    const consTail = cons.contacts.get('tail')!
    const consOutput = cons.contacts.get('output')!
    
    propagate(consHead, createSignal(0, 1.0))
    propagate(consTail, createSignal(list, 1.0))
    console.log(`cons(0, [1,2,3,4,5]) = ${stringify(consOutput.signal.value)}`)
  }
  
  // Test 4: Pairs and intervals
  console.log('\n' + '=' .repeat(50))
  console.log('\nTest 4: Pairs as Intervals')
  {
    const pairMaker = createPair('make-pair')
    const first = pairMaker.contacts.get('first')!
    const second = pairMaker.contacts.get('second')!
    const pairOut = pairMaker.contacts.get('output')!
    
    // Create interval [3, 7]
    propagate(first, createSignal(3, 1.0))
    propagate(second, createSignal(7, 1.0))
    console.log(`Interval: ${stringify(pairOut.signal.value)}`)
    
    // Add intervals
    const intervalAdder = createIntervalAdd('interval-add')
    const intA = intervalAdder.contacts.get('a')!
    const intB = intervalAdder.contacts.get('b')!
    const intOut = intervalAdder.contacts.get('output')!
    
    propagate(intA, createSignal([2, 4], 0.8))
    propagate(intB, createSignal([3, 7], 0.6))
    console.log(`[2,4] + [3,7] = ${stringify(intOut.signal.value)}`)
    console.log(`Output strength: ${intOut.signal.strength} (MIN of 0.8 and 0.6)`)
  }
  
  // Test 5: Tagged values
  console.log('\n' + '=' .repeat(50))
  console.log('\nTest 5: Tagged Values')
  {
    // Create tagged values
    const maybe = tag('maybe', 42)
    const none = tag('none', null)
    const complex = tag('complex', {real: 3, imag: 4})
    
    console.log(`Maybe value: ${JSON.stringify(maybe)}`)
    console.log(`None value: ${JSON.stringify(none)}`)
    console.log(`Complex number: ${JSON.stringify(complex)}`)
    
    // Check with predicates
    const pairChecker = createPairP('pair-check')
    const pairInput = pairChecker.contacts.get('value')!
    const pairOutput = pairChecker.contacts.get('output')!
    
    propagate(pairInput, createSignal([1, 2], 1.0))
    console.log(`Is [1,2] a pair? ${stringify(pairOutput.signal.value)}`)
    
    propagate(pairInput, createSignal([1, 2, 3], 1.5))
    console.log(`Is [1,2,3] a pair? ${stringify(pairOutput.signal.value)}`)
  }
  
  // Test 6: Contradiction propagation with strength
  console.log('\n' + '=' .repeat(50))
  console.log('\nTest 6: Contradiction Strength')
  {
    const network = createGadget('network')
    const input = createContact('input', network)
    network.contacts.set('input', input)
    
    // Weak valid signal
    propagate(input, createSignal(42, 0.3))
    console.log(`Weak valid: value=${stringify(input.signal.value)}, strength=${input.signal.strength}`)
    
    // Strong contradiction overpowers
    const error = contradiction('System error', [42])
    propagate(input, createSignal(error as Value, 0.8))
    console.log(`Strong error: value=${stringify(input.signal.value)}, strength=${input.signal.strength}`)
    
    // Very strong valid signal overpowers contradiction
    propagate(input, createSignal(100, 0.95))
    console.log(`Strong valid: value=${stringify(input.signal.value)}, strength=${input.signal.strength}`)
  }
  
  console.log('\n' + '=' .repeat(50))
  console.log('\nAll type tests completed!')
}

// Run the tests
runTests()