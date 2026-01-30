export * as graph from './graph'
export * as theme from './theme'

// little serialization test, will use later for storing the graph
// const imports = {
//   something: 123,
//   another: 123123,
//   yetAnother: 69,
//   // @ts-ignore
//   load(value: any) {
//     // @ts-ignore
//     return imports[value] ?? 'unknown-import'
//   },
// }

// const imp = (path: string) => ({
//   path,
//   toJSON() {
//     return { $IMPORT: path }
//   },
// })

// const obj = {
//   data: {
//     a: { foo: 1 },
//     b: { bar: 2 },
//     c: { baz: 3 },
//   },
//   toJson() {},
// }

// function replacer(key: string, value: any) {
//   if (typeof value === 'object' && Reflect.has(value, 'foo')) return '$FOO'
//   return value
// }

// function reviver(key: string, value: any) {
//   const imp = value.$IMPORT
//   if (imp) {
//     return imports.load(imp)
//   }
//   if (value === '$FOO') return { foo: 1 }
//   return value
// }

// const withImports = { a: imp('something'), b: imp('another'), c: imp('unknown') }
// const importStr = JSON.stringify(withImports)
// console.log(importStr)
// console.log(JSON.parse(importStr, reviver))
