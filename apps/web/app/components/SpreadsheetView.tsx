import { useState } from "react";
import type { Spreadsheet } from "@bassline/parser";
import { CELLS as c, TYPES as t } from "@bassline/parser";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "~/components/ui/table";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";

interface SpreadsheetViewProps {
    spreadsheet: Spreadsheet | null;
    onCellUpdate?: (cellName: string, value: any) => void;
}

export function SpreadsheetView(
    { spreadsheet, onCellUpdate }: SpreadsheetViewProps,
) {
    const [editingCell, setEditingCell] = useState<string | null>(null);
    const [editValue, setEditValue] = useState<string>("");

    if (!spreadsheet) {
        return (
            <Card>
                <CardContent className="py-8">
                    <div className="text-center text-muted-foreground">
                        <p>No spreadsheet loaded</p>
                        <p className="text-sm mt-2">
                            Create a spreadsheet using the SPREADSHEET function
                        </p>
                    </div>
                </CardContent>
            </Card>
        );
    }

    const values = spreadsheet.getValues();
    const entries = Object.entries(values);

    if (entries.length === 0) {
        return (
            <Card>
                <CardContent className="py-8">
                    <div className="text-center text-muted-foreground">
                        <p>Spreadsheet is empty</p>
                    </div>
                </CardContent>
            </Card>
        );
    }

    const handleCellClick = (cellName: string, currentValue: any) => {
        setEditingCell(cellName);
        if (currentValue && currentValue.type === t.number) {
            setEditValue(String(currentValue.value));
        } else if (currentValue && currentValue.type === t.string) {
            setEditValue(currentValue.value);
        } else {
            setEditValue("");
        }
    };

    const handleCellSave = (cellName: string) => {
        if (onCellUpdate && editValue.trim()) {
            // Try to parse as number, otherwise treat as string
            const numValue = parseFloat(editValue);
            const value = isNaN(numValue)
                ? c.string(editValue)
                : c.number(numValue);
            onCellUpdate(cellName, value);
        }
        setEditingCell(null);
        setEditValue("");
    };

    const handleCellCancel = () => {
        setEditingCell(null);
        setEditValue("");
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Spreadsheet</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[200px]">
                                    Cell
                                </TableHead>
                                <TableHead>Value</TableHead>
                                <TableHead className="w-[100px]">
                                    Type
                                </TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {entries.map(([cellName, value]) => {
                                const cell = spreadsheet.cells[cellName];
                                const hasFormula = cell?.formula !== null;

                                let displayValue: string;
                                let valueType: string;

                                if (value === undefined || value === null) {
                                    displayValue = "(undefined)";
                                    valueType = "undefined";
                                } else if (value.type === t.number) {
                                    displayValue = String(value.value);
                                    valueType = "number";
                                } else if (value.type === t.string) {
                                    displayValue = `"${value.value}"`;
                                    valueType = "string";
                                } else {
                                    displayValue = JSON.stringify(value);
                                    valueType = value.type || "unknown";
                                }

                                const isEditing = editingCell === cellName;

                                return (
                                    <TableRow key={cellName}>
                                        <TableCell className="font-mono font-semibold">
                                            {cellName}
                                        </TableCell>
                                        <TableCell className="font-mono">
                                            {isEditing
                                                ? (
                                                    <div className="flex gap-2">
                                                        <Input
                                                            value={editValue}
                                                            onChange={(e) =>
                                                                setEditValue(
                                                                    e.target
                                                                        .value,
                                                                )}
                                                            onBlur={() =>
                                                                handleCellSave(
                                                                    cellName,
                                                                )}
                                                            onKeyDown={(e) => {
                                                                if (
                                                                    e.key ===
                                                                        "Enter"
                                                                ) {
                                                                    e.preventDefault();
                                                                    handleCellSave(
                                                                        cellName,
                                                                    );
                                                                } else if (
                                                                    e.key ===
                                                                        "Escape"
                                                                ) {
                                                                    e.preventDefault();
                                                                    handleCellCancel();
                                                                }
                                                            }}
                                                            autoFocus
                                                            className="h-8"
                                                        />
                                                    </div>
                                                )
                                                : (
                                                    <button
                                                        onClick={() =>
                                                            handleCellClick(
                                                                cellName,
                                                                value,
                                                            )}
                                                        className="hover:bg-muted px-2 py-1 rounded cursor-pointer w-full text-left"
                                                        disabled={hasFormula}
                                                        title={hasFormula
                                                            ? "Formula cells cannot be edited directly"
                                                            : "Click to edit"}
                                                    >
                                                        {displayValue}
                                                    </button>
                                                )}
                                        </TableCell>
                                        <TableCell>
                                            <Badge
                                                variant={hasFormula
                                                    ? "default"
                                                    : "outline"}
                                            >
                                                {hasFormula
                                                    ? "Formula"
                                                    : valueType}
                                            </Badge>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
}
