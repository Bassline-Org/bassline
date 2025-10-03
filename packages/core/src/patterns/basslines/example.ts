import { Implements } from "../../core/context";
import { Table, Valued } from "../../core/protocols";
import { table, SweetTable, SweetCell, cells } from "../../sugar";

const network = <T>() => table.first<T>({} as Record<string, T>)

const tableNetwork = network<SweetTable<any> & Implements<Table<string, any>>>();

type NodeType = 'min' | 'max';

tableNetwork.set({
  'nodes': table.first<NodeType>({}),
  'min': table.first<Implements<Valued<number>> & SweetCell<number>>({}),
  'max': table.first<Implements<Valued<number>> & SweetCell<number>>({}),
});

const [nodes, min, max] = tableNetwork.getMany(['nodes', 'min', 'max'])

nodes!.whenAdded((key, v) => {
  const factory = cells[v]!;
  tableNetwork.get(v)!.set({
    [key]: factory(),
  })
});

min!.whenAdded((key, v) => {
  nodes!.set({
    [key]: 'min',
  })
});

max!.whenAdded((key, v) => {
  nodes!.set({
    [key]: 'max',
  })
});

nodes!.set({
  'foo': 'min',
  'bar': 'max',
});
min!.set({
  'baz': cells.min(10),
});
max!.set({
  'qux': cells.max(20),
});

console.log(Object.keys(min!.current()))
console.log(Object.values(max!.current()))
console.log(Object.keys(nodes!.current))