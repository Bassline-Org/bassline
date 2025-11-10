import { useMemo } from "react";
import { serialize } from "@bassline/parser/types";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "~/components/ui/table";

interface QueryResultsTableProps {
    results: any[]; // Array of Match objects
}

export function QueryResultsTable({ results }: QueryResultsTableProps) {
    // Extract variable names (Symbol keys) from first result
    const variables = useMemo(() => {
        if (!results || results.length === 0) return [];
        const firstMatch = results[0];
        if (!firstMatch?.bindings) return [];
        // Use getOwnPropertySymbols to get Symbol keys (variable names)
        return Object.getOwnPropertySymbols(firstMatch.bindings);
    }, [results]);

    if (!results || results.length === 0) {
        return null;
    }

    return (
        <div className="border rounded-lg">
            <Table>
                <TableHeader>
                    <TableRow>
                        {variables.map((varSymbol) => (
                            <TableHead key={varSymbol.toString()} className="font-mono">
                                ?{varSymbol.description}
                            </TableHead>
                        ))}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {results.map((match, i) => (
                        <TableRow key={i}>
                            {variables.map((varSymbol) => {
                                const value = match.bindings[varSymbol];
                                return (
                                    <TableCell key={varSymbol.toString()} className="font-mono text-sm">
                                        {value !== undefined ? serialize(value) : ""}
                                    </TableCell>
                                );
                            })}
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
            <div className="p-2 text-xs text-slate-500 border-t">
                {results.length} {results.length === 1 ? "result" : "results"}
            </div>
        </div>
    );
}
