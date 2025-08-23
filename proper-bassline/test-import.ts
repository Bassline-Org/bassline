/**
 * Test dynamic module import and function propagation
 */

import { Network } from './src/network'
import { OrdinalCell } from './src/cells/basic'
import { ImportModule, DynamicFunction, ModuleFunction } from './src/functions/import'
import { str, num, obj, fn } from './src/types'

console.log('=== Testing Module Import and Function Propagation ===\n')

const network = new Network('import-test')

// Test 1: Import a module and use it
console.log('Test 1: Import lodash and use a function')
const moduleUrl = new OrdinalCell('module-url')
const importer = new ImportModule('importer')
const funcName = new OrdinalCell('func-name')
const input = new OrdinalCell('input')
const moduleFunc = new ModuleFunction('module-func')

// Connect them
importer.connectFrom('url', moduleUrl)
moduleFunc.connectFrom('module', importer)
moduleFunc.connectFrom('functionName', funcName)
moduleFunc.connectFrom('input', input)

// Add to network
network.add(moduleUrl, importer, funcName, input, moduleFunc)

// Set values - use absolute path for the module
moduleUrl.userInput(str('../../test-utils'))
funcName.userInput(str('capitalize'))
input.userInput(str('hello world'))

// Trigger computation
importer.compute()

// Wait for async import
setTimeout(() => {
  console.log('Importer output:', importer.getOutput())
  console.log('Module function result:', moduleFunc.getOutput())
  
  // Try to compute the module function
  moduleFunc.compute()
  console.log('Module function after compute:', moduleFunc.getOutput())
}, 2000)

// Test 2: Propagate a function directly
console.log('\nTest 2: Propagate a custom function')
const customFunc = new OrdinalCell('custom-func')
const dynamicInput = new OrdinalCell('dynamic-input')
const dynamicFunc = new DynamicFunction('dynamic-func')

// Create a custom function
const myFunction = (input: any) => {
  if (input?.type === 'number') {
    return input.value * 2
  } else if (input?.type === 'string') {
    return input.value.toUpperCase()
  }
  return null
}

// Connect
dynamicFunc.connectFrom('function', customFunc)
dynamicFunc.connectFrom('input', dynamicInput)

// Add to network
network.add(customFunc, dynamicInput, dynamicFunc)

// Set the function and input
customFunc.userInput(fn(myFunction))
dynamicInput.userInput(num(21))

// Compute
dynamicFunc.compute()
console.log('Dynamic function result (21 * 2):', dynamicFunc.getOutput())

// Change the input
dynamicInput.userInput(str('hello'))
dynamicFunc.compute()
console.log('Dynamic function result (uppercase):', dynamicFunc.getOutput())

// Test 3: Hot-reload behavior
console.log('\nTest 3: Hot-reload function behavior')
const newFunction = (input: any) => {
  // Different behavior - add 100 instead of multiply by 2
  if (input?.type === 'number') {
    return input.value + 100
  }
  return 'modified'
}

// Update the function
customFunc.userInput(fn(newFunction))
dynamicInput.userInput(num(21))
dynamicFunc.compute()
console.log('After function update (21 + 100):', dynamicFunc.getOutput())

console.log('\n✅ Function propagation test complete!')