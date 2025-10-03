import { cells, SweetCell } from '.';
import { Implements } from '../core/context';
import { Valued } from '../core/protocols';
import { table } from './tables';

type Pos = { x: number, y: number }
type NodeType = 'max' | 'min' | 'union'
type SCell<T> = Implements<Valued<T>> & SweetCell<T>
type Dims = { width: number, height: number };
type NodeValue = {
    position: Pos,
    type: NodeType,
    dims: Dims
}

type Id = string;

type NodeTableValues = Record<Id, NodeValue>;

type NodeRow = {
    position: SCell<Pos>,
    type: SCell<NodeType>,
    dims: SCell<Dims>,
    gadget: unknown,
}

const nodes = table.first<NodeRow>({} as Record<string, NodeRow>);

nodes.whenAdded((key, value) => {
    console.log('node row added: key: ', key);
});

nodes.set({
    foo: {
        position: cells.last<Pos>({ x: 100, y: 100 }),
        type: cells.last<NodeType>('max'),
        dims: cells.last<Dims>({ width: 50, height: 50 }),
        gadget: cells.max(),
    },
    bar: {
        position: cells.last<Pos>({ x: 200, y: 200 }),
        type: cells.last<NodeType>('max'),
        dims: cells.last<Dims>({ width: 50, height: 50 }),
        gadget: cells.max(),
    },
});

// const [fromNodes, cleanup] = table.flattenTable<NodeRow, NodeValue>(nodes);

// fromNodes.whenAdded((k, v) => {
//     console.log('from nodes added key: ', k, ' value: ', v);
// })

nodes.set({
    baz: {
        position: cells.last<Pos>({ x: 300, y: 300 }),
        type: cells.last<NodeType>('min'),
        dims: cells.last<Dims>({ width: 50, height: 50 }),
        gadget: cells.max(),
    },
});

//console.log('from nodes: ', fromNodes.current());

nodes.get('foo')!.dims.receive({ width: 50, height: 100 });