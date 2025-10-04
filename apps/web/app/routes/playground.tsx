import { cells, table, withMetadata, type Implements, type SweetCell, type Valued } from "@bassline/core"
import { useGadget, useMetadata } from "@bassline/react";
import { Inspector } from "~/components/inspector";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";

export function meta() {
    return [
        { title: "Playground" },
        { name: "description", content: "Playground" },
    ]
}

type Cell<T> = Implements<Valued<T>> & SweetCell<T>
const systemMeta: Record<string, Cell<string>> = {
    'type': cells.last('core/table'),
    'category': cells.last('table'),
    'description': cells.last('The root table of my playground! This is basically the entry point for the entire system.'),
    'author': cells.last('@goose :)'),
    'views/inspector/type': cells.last('table'),
};

const groupsMeta: Record<string, Cell<string>> = {
    'type': cells.last('core/table'),
    'category': cells.last('table'),
    'description': cells.last('The groups table for the system'),
    'author': cells.last('@goose :)'),
    'views/inspector/type': cells.last('table'),
};

const packagesMeta: Record<string, Cell<string>> = {
    'type': cells.last('core/table'),
    'category': cells.last('table'),
    'description': cells.last('The packages table for the system'),
    'author': cells.last('@goose :)'),
    'views/inspector/type': cells.last('table'),
};

const systemTable = withMetadata(table.first({
    'groups': withMetadata(table.first({}), groupsMeta as Record<string, Cell<unknown>>),
    'packages': withMetadata(table.first({}), packagesMeta as Record<string, Cell<unknown>>),
}), systemMeta as Record<string, Cell<unknown>>);

export function CellTableEntry({ gadget, field }: { gadget: Implements<Valued<Record<string, Cell<any>>>>, field: string }) {
    const [state] = useGadget(gadget);
    return (
        <TableRow>
            <TableCell className="font-mono font-bold text-slate-600">{field}</TableCell>
            <TableCell className="font-mono">{JSON.stringify(state)}</TableCell>
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
    const [system] = useGadget(systemTable);
    return (
        <div>
            {
                Object.entries(system).map(([key, gadget]) => (
                    <NamespaceInspector key={key} name={key} g={gadget} />
                ))
            }
        </div>
    )
}