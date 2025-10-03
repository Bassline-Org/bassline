import { cells, table, withMetadata, type Implements, type SweetCell, type Valued } from "@bassline/core"
import { useGadget, useMetadata } from "@bassline/react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";

export function meta() {
    return [
        { title: "Playground" },
        { name: "description", content: "Playground" },
    ]
}

const a = cells.last(0);
const b = cells.last(0);
const c = cells.last(0);

type Cell<T> = Implements<Valued<T>> & SweetCell<T>

const rootMeta: Record<string, Cell<string>> = {
    'meta/type': cells.last('core/table'),
    'meta/category': cells.last('table'),
    'meta/description': cells.last('The root table of my playground!'),
    'views/inspector/type': cells.last('table'),
}

function TableInspector({ gadget }: { gadget: Implements<Valued<Record<string, any>>> }) {
    const [state] = useGadget(gadget);
    return (
        <div>
            <h1>Table Inspector</h1>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Key</TableHead>
                        <TableHead>Value</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {Object.entries(state).map(([key, value]) => (
                        <TableRow key={key}>
                            <TableCell>{key}</TableCell>
                            <TableCell>{JSON.stringify(value)}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    )
}

function NumericInspector({ gadget }: { gadget: Implements<Valued<number>> }) {
    const [state] = useGadget(gadget);
    return (
        <div>
            <h1>Numeric Inspector</h1>
            <p>Type: {state}</p>
        </div>
    )
}

function SetInspector({ gadget }: { gadget: Implements<Valued<Set<any>>> }) {
    const [state] = useGadget(gadget);
    return (
        <div>
            <h1>Set Inspector</h1>
            <p>Type: {state}</p>
        </div>
    )
}

function UnknownInspector({ key }: { key: string }) {
    return (
        <div>
            <h1>Unknown Inspector</h1>
            <p>Type: {key}</p>
        </div>
    )
}

const inspectors = {
    table: TableInspector,
    numeric: NumericInspector,
    set: SetInspector,
    unknown: UnknownInspector,
}

function Inspector({ gadget }: { gadget: Implements<Valued<any>> }) {
    const meta = useMetadata(gadget);
    if (!meta) return <UnknownInspector key="unknown" />;
    const [type] = useGadget(meta['views/inspector/type']);
    const SelectedInspector = inspectors[type] ?? UnknownInspector;
    return <SelectedInspector gadget={gadget} key={type} />
}

// const root = withMetadata(table.first({
//     a: a,
//     b: b,
//     c: c,
// }), rootMeta as Record<string, Cell<unknown>>);

const example = table.first({
    number: cells.max(0),
    set: cells.union([1, 2, 3]),
    table: withMetadata(table.first({
        a: cells.max(0),
        b: cells.max(0),
        c: cells.max(0),
    }), rootMeta as Record<string, Cell<unknown>>),
    unknown: cells.last('unknown'),
})

// const d = cells.last(0);
// const e = cells.last(0);
// const f = cells.last(0);

// const alt = table.first({
//     a: a,
//     d: d,
//     e: e,
//     f: f,
// })

export function CellTableEntry({ gadget, field }: { gadget: Implements<Valued<Record<string, Cell<any>>>>, field: string }) {
    const [state] = useGadget(gadget);
    return (
        <TableRow>
            <TableCell className="font-mono font-bold text-slate-600">{field}</TableCell>
            <TableCell className="font-mono">{state}</TableCell>
        </TableRow>
    )
}

function NamespaceInspector({ name, g }: { name: string, g: Implements<Valued<Record<string, Cell<unknown>>>> }) {
    const [state] = useGadget(g);
    return (
        <div className="space-y-4">
            <h2 className="text-xl font-semibold text-slate-900">Namespace: {name}</h2>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="font-semibold">Key</TableHead>
                        <TableHead className="font-semibold">Value</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {Object.entries(state).map(([key, gadget]) => (
                        <CellTableEntry key={key} gadget={gadget} field={key} />
                    ))}
                </TableBody>
            </Table>
        </div>
    )
}

export default function Playground() {
    const [state] = useGadget(example);
    return (
        <div>
            <Inspector gadget={state['table']} />
            <Inspector gadget={state['number']} />
            <Inspector gadget={state['set']} />
            <Inspector gadget={state['unknown']} />
        </div>
    )
}