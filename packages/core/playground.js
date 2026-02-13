import { MyClass } from "./dist/index.mjs"

console.log("Is it testable? ", MyClass.isTestable)

const something = new MyClass()

console.log(something.foo())
console.log(something.unboundFoo())

const boundFoo = something.foo;
const unboundFoo = something.unboundFoo;

console.log('boundFoo: ', boundFoo())
console.log('unboundFoo: ', unboundFoo())