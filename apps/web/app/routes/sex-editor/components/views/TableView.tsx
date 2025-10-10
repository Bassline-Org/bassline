import { memo, useEffect, useState } from "react";
import type { NodeProps } from "@xyflow/react";
import { Handle, Position } from "@xyflow/react";
import styles from "../WorkspaceTree.module.css";

export const TableView = memo(({ data, selected }: NodeProps) => {
    const { name, gadget } = data;
    const state = gadget.useCurrent();
    const [isFlashing, setIsFlashing] = useState(false);

    // Flash animation on receive
    useEffect(() => {
        const cleanup = gadget.tap(() => {
            setIsFlashing(true);
            setTimeout(() => setIsFlashing(false), 300);
        });
        return cleanup;
    }, [gadget]);

    // Prepare table data
    let rows: any[] = [];
    let columns: string[] = [];

    if (Array.isArray(state)) {
        rows = state;
        if (rows.length > 0 && typeof rows[0] === "object" && rows[0] !== null) {
            columns = Object.keys(rows[0]);
        }
    } else if (typeof state === "object" && state !== null) {
        // Convert object to array of {key, value} pairs
        rows = Object.entries(state).map(([k, v]) => ({ key: k, value: v }));
        columns = ["key", "value"];
    }

    const formatValue = (val: any): string => {
        if (val === null || val === undefined) return "null";
        if (typeof val === "object") {
            return Array.isArray(val) ? `[${val.length}]` : `{${Object.keys(val).length}}`;
        }
        const str = String(val);
        return str.length > 30 ? str.slice(0, 30) + "..." : str;
    };

    return (
        <div
            className={`bg-white border-2 rounded-lg shadow-lg min-w-[400px] max-w-[600px] ${
                selected ? "border-purple-500 ring-2 ring-purple-300" : "border-purple-400"
            } ${isFlashing ? styles.flash : ""}`}
        >
            {/* Connection handles */}
            <Handle type="target" position={Position.Top} className="!bg-purple-500" />
            <Handle type="source" position={Position.Bottom} className="!bg-purple-500" />

            {/* Content */}
            <div className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm">{name}</span>
                    <span className="text-xs text-gray-400">
                        {rows.length} rows
                    </span>
                </div>

                {rows.length > 0 && columns.length > 0 ? (
                    <div className="overflow-auto max-h-[300px] border rounded">
                        <table className="w-full text-xs">
                            <thead className="bg-gray-50 sticky top-0">
                                <tr>
                                    {columns.map((col) => (
                                        <th
                                            key={col}
                                            className="text-left px-2 py-1 font-semibold text-gray-700 border-b"
                                        >
                                            {col}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {rows.slice(0, 100).map((row, i) => (
                                    <tr
                                        key={i}
                                        className="hover:bg-gray-50 border-b last:border-b-0"
                                    >
                                        {columns.map((col) => (
                                            <td
                                                key={col}
                                                className="px-2 py-1 font-mono text-gray-600"
                                            >
                                                {formatValue(row[col])}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {rows.length > 100 && (
                            <div className="text-center py-2 text-xs text-gray-400 bg-gray-50">
                                Showing first 100 of {rows.length} rows
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="h-[100px] flex items-center justify-center text-gray-400 text-sm border rounded">
                        No data to display
                    </div>
                )}

                <div className="text-xs text-gray-400 font-mono truncate">
                    {gadget.pkg}/{gadget.name}
                </div>
            </div>
        </div>
    );
});

TableView.displayName = "TableView";
