/**
 * Network DSL Gadget
 *
 * Implements the Network Language (see README.md)
 *
 * Purpose: High-level network construction
 * Compilation: Forwards to infrastructure gadgets (spawning, wiring)
 */

import { table, SweetTable } from '../../../sugar/tables';

const namespaces = table.first<SweetTable<number>>({})

namespaces.whenAdded((k, v) => {
  console.log('namespace added: ', k, ' value: ', v);
  v.whenAdded((addedKey, addedValue) => {
    console.log('table: ', k, 'added key: ', addedKey, ' with val: ', addedValue)
  })
})

namespaces.set({
  a: table.first({}),
  b: table.first({}),
});


const [a, b] = namespaces.getMany(['a', 'b']);

a?.set({
  foo: 1,
  bar: 2,
  baz: 3
})

a?.set({
  foo: 123
})

console.log('a: ', a!.current());
console.log('b: ', b!.current())

const q = a!.query()
  .whereKeys(k => k.startsWith('b'))
  .whereValues(v => v % 2 === 0)
  .table;

console.log(q)