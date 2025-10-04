import type { Implements, Valued } from "@bassline/core";
import { useGadget, useMetadata } from "@bassline/react";
import { TableHead, TableCell, TableBody, TableHeader, TableRow, Table } from "../ui/table";

function TableInspector({ gadget }: { gadget: Implements<Valued<Record<string, any>>> }) {
    const [state] = useGadget(gadget);
    return (
        <div>
            <h1>Table Inspector </h1>
            < Table >
                <TableHeader>
                    <TableRow>
                        <TableHead>Key </TableHead>
                        < TableHead > Value </TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {
                        Object.entries(state).map(([key, value]) => (
                            <TableRow key={key} >
                                <TableCell>{key} </TableCell>
                                < TableCell > {JSON.stringify(value)} </TableCell>
                            </TableRow>
                        ))
                    }
                </TableBody>
            </Table>
        </div>
    )
}

function NumericInspector({ gadget }: { gadget: Implements<Valued<number>> }) {
    const [state] = useGadget(gadget);
    return (
        <div>
            <h1>Numeric Inspector </h1>
            < p > Type: {state} </p>
        </div>
    )
}

function SetInspector({ gadget }: { gadget: Implements<Valued<Set<any>>> }) {
    const [state] = useGadget(gadget);
    return (
        <div>
            <h1>Set Inspector </h1>
            < p > Type: {state} </p>
        </div>
    )
}

function UnknownInspector({ key }: { key: string }) {
    return (
        <div>
            <h1>Unknown Inspector </h1>
            < p > Type: {key} </p>
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

export {
    Inspector,
}