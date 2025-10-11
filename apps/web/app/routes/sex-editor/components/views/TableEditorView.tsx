import { memo, useState, useEffect } from "react";
import type { NodeProps } from "@xyflow/react";
import { Button } from "~/components/ui/button";

interface Row {
    id: string;
    key: string;
    value: any;
    type: "string" | "number" | "boolean" | "json";
}

export const TableEditorView = memo(({ data }: NodeProps) => {
    const { gadget } = data;
    const rawValue = gadget.useCurrent();

    // Ensure value is always an object
    const value = (rawValue && typeof rawValue === "object" && !Array.isArray(rawValue)) ? rawValue : {};

    // Convert object to rows
    const objectToRows = (obj: Record<string, any>): Row[] => {
        if (!obj || typeof obj !== "object" || Array.isArray(obj)) return [];
        return Object.entries(obj).map(([key, val]) => ({
            id: Math.random().toString(36).slice(2),
            key,
            value: val,
            type: inferType(val),
        }));
    };

    const inferType = (val: any): Row["type"] => {
        if (typeof val === "number") return "number";
        if (typeof val === "boolean") return "boolean";
        if (typeof val === "string") return "string";
        return "json";
    };

    const [rows, setRows] = useState<Row[]>(() => objectToRows(value));

    // Sync rows when gadget state changes externally
    useEffect(() => {
        setRows(objectToRows(value));
    }, [value]);

    const rowsToObject = (rows: Row[]): Record<string, any> => {
        const obj: Record<string, any> = {};
        rows.forEach(row => {
            if (row.key.trim()) {
                obj[row.key] = row.value;
            }
        });
        return obj;
    };

    const handleAddRow = () => {
        const newRow: Row = {
            id: Math.random().toString(36).slice(2),
            key: "",
            value: "",
            type: "string",
        };
        const newRows = [...rows, newRow];
        setRows(newRows);
    };

    const handleDeleteRow = (id: string) => {
        const newRows = rows.filter(row => row.id !== id);
        setRows(newRows);
        gadget.receive(rowsToObject(newRows));
    };

    const handleKeyChange = (id: string, newKey: string) => {
        const newRows = rows.map(row =>
            row.id === id ? { ...row, key: newKey } : row
        );
        setRows(newRows);
    };

    const handleValueChange = (id: string, newValue: string) => {
        const newRows = rows.map(row => {
            if (row.id !== id) return row;

            let parsedValue: any = newValue;
            switch (row.type) {
                case "number":
                    parsedValue = newValue === "" ? 0 : Number(newValue);
                    break;
                case "boolean":
                    parsedValue = newValue === "true";
                    break;
                case "json":
                    try {
                        parsedValue = JSON.parse(newValue);
                    } catch {
                        parsedValue = newValue;
                    }
                    break;
                default:
                    parsedValue = newValue;
            }

            return { ...row, value: parsedValue };
        });
        setRows(newRows);
    };

    const handleTypeChange = (id: string, newType: Row["type"]) => {
        const newRows = rows.map(row => {
            if (row.id !== id) return row;

            // Convert value to new type
            let convertedValue: any = row.value;
            switch (newType) {
                case "number":
                    convertedValue = Number(row.value) || 0;
                    break;
                case "boolean":
                    convertedValue = Boolean(row.value);
                    break;
                case "string":
                    convertedValue = String(row.value);
                    break;
                case "json":
                    convertedValue = row.value;
                    break;
            }

            return { ...row, type: newType, value: convertedValue };
        });
        setRows(newRows);
    };

    const handleBlur = () => {
        gadget.receive(rowsToObject(rows));
    };

    return (
        <div className="p-2">
            {rows.length === 0 ? (
                <div className="text-center py-4">
                    <div className="text-gray-500 text-sm mb-2">No entries yet</div>
                    <Button size="sm" onClick={handleAddRow}>
                        Add First Entry
                    </Button>
                </div>
            ) : (
                <>
                    <div className="bg-gray-50 px-2 py-1 flex items-center text-xs font-semibold text-gray-600 border rounded-t">
                        <div className="flex-1">Key</div>
                        <div className="flex-1">Value</div>
                        <div className="w-20">Type</div>
                        <div className="w-8"></div>
                    </div>
                    <div className="divide-y border-l border-r max-h-64 overflow-auto">
                        {rows.map((row) => {
                            const displayValue = row.type === "json"
                                ? JSON.stringify(row.value)
                                : row.type === "boolean"
                                    ? String(row.value)
                                    : row.value;

                            return (
                                <div key={row.id} className="flex items-center p-2 gap-2 hover:bg-gray-50">
                                    <input
                                        type="text"
                                        value={row.key}
                                        onChange={(e) => handleKeyChange(row.id, e.target.value)}
                                        onBlur={handleBlur}
                                        placeholder="key"
                                        className="flex-1 px-2 py-1 text-sm border rounded font-mono"
                                    />
                                    {row.type === "boolean" ? (
                                        <select
                                            value={String(row.value)}
                                            onChange={(e) => handleValueChange(row.id, e.target.value)}
                                            onBlur={handleBlur}
                                            className="flex-1 px-2 py-1 text-sm border rounded"
                                        >
                                            <option value="true">true</option>
                                            <option value="false">false</option>
                                        </select>
                                    ) : (
                                        <input
                                            type={row.type === "number" ? "number" : "text"}
                                            value={displayValue}
                                            onChange={(e) => handleValueChange(row.id, e.target.value)}
                                            onBlur={handleBlur}
                                            placeholder="value"
                                            className="flex-1 px-2 py-1 text-sm border rounded font-mono"
                                        />
                                    )}
                                    <select
                                        value={row.type}
                                        onChange={(e) => handleTypeChange(row.id, e.target.value as Row["type"])}
                                        className="w-20 px-1 py-1 text-xs border rounded"
                                    >
                                        <option value="string">str</option>
                                        <option value="number">num</option>
                                        <option value="boolean">bool</option>
                                        <option value="json">json</option>
                                    </select>
                                    <button
                                        onClick={() => handleDeleteRow(row.id)}
                                        className="w-8 h-8 flex items-center justify-center text-red-600 hover:bg-red-50 rounded"
                                        title="Delete row"
                                    >
                                        ×
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                    <div className="p-2 border-l border-r border-b bg-gray-50 rounded-b">
                        <Button size="sm" onClick={handleAddRow} className="w-full">
                            + Add Row
                        </Button>
                    </div>
                </>
            )}
        </div>
    );
});

TableEditorView.displayName = "TableEditorView";
