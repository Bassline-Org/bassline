import { memo, useState } from "react";
import type { NodeProps } from "@xyflow/react";

export const SexTableView = memo(({ data }: NodeProps) => {
    const { gadget } = data; // This is a sex gadget
    const workspace = gadget.useCurrent(); // All spawned gadgets

    const [sortKey, setSortKey] = useState<"name" | "pkg" | "type" | "view">(
        "name",
    );
    const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

    // Prepare table data
    const rows = Object.entries(workspace)
        .map(([name, g]) => {
            const isWire = g.pkg === "@bassline/relations" &&
                g.name === "scopedWire";
            const state = g.current();

            return {
                name,
                pkg: g.pkg || "unknown",
                type: g.name || "unknown",
                view: g.getView ? g.getView() : "default",
                isWire,
                state: JSON.stringify(state).slice(0, 100),
            };
        })
        .sort((a, b) => {
            const aVal = a[sortKey];
            const bVal = b[sortKey];
            const compare = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
            return sortDir === "asc" ? compare : -compare;
        });

    const handleSort = (key: typeof sortKey) => {
        if (sortKey === key) {
            setSortDir(sortDir === "asc" ? "desc" : "asc");
        } else {
            setSortKey(key);
            setSortDir("asc");
        }
    };

    const SortIcon = ({ column }: { column: typeof sortKey }) => {
        if (sortKey !== column) return null;
        return <span className="ml-1">{sortDir === "asc" ? "↑" : "↓"}</span>;
    };

    return (
        <div className="w-full h-full bg-white overflow-auto">
            <div className="p-6">
                <div className="mb-4">
                    <h2 className="text-2xl font-bold text-gray-800">
                        Workspace Table View
                    </h2>
                    <p className="text-sm text-gray-500 mt-1">
                        {rows.length} gadget{rows.length !== 1 ? "s" : ""}{" "}
                        in workspace
                    </p>
                </div>

                <div className="border rounded-lg overflow-hidden">
                    <table className="w-full">
                        <thead className="bg-gray-50">
                            <tr>
                                <th
                                    onClick={() => handleSort("name")}
                                    className="text-left px-4 py-3 font-semibold text-gray-700 cursor-pointer hover:bg-gray-100"
                                >
                                    Name <SortIcon column="name" />
                                </th>
                                <th
                                    onClick={() => handleSort("pkg")}
                                    className="text-left px-4 py-3 font-semibold text-gray-700 cursor-pointer hover:bg-gray-100"
                                >
                                    Package <SortIcon column="pkg" />
                                </th>
                                <th
                                    onClick={() => handleSort("type")}
                                    className="text-left px-4 py-3 font-semibold text-gray-700 cursor-pointer hover:bg-gray-100"
                                >
                                    Type <SortIcon column="type" />
                                </th>
                                <th
                                    onClick={() => handleSort("view")}
                                    className="text-left px-4 py-3 font-semibold text-gray-700 cursor-pointer hover:bg-gray-100"
                                >
                                    View <SortIcon column="view" />
                                </th>
                                <th className="text-left px-4 py-3 font-semibold text-gray-700">
                                    State Preview
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((row, i) => (
                                <tr
                                    key={row.name}
                                    className={`border-t hover:bg-gray-50 ${
                                        row.isWire ? "bg-blue-50" : ""
                                    }`}
                                >
                                    <td className="px-4 py-3 font-mono text-sm font-semibold">
                                        {row.name}
                                    </td>
                                    <td className="px-4 py-3 font-mono text-xs text-gray-600">
                                        {row.pkg}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-gray-700">
                                        {row.type}
                                    </td>
                                    <td className="px-4 py-3">
                                        <span
                                            className={`px-2 py-1 text-xs rounded ${
                                                row.view === "default"
                                                    ? "bg-gray-100 text-gray-600"
                                                    : "bg-blue-100 text-blue-700"
                                            }`}
                                        >
                                            {row.view}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 font-mono text-xs text-gray-500 max-w-xs truncate">
                                        {row.state}
                                        {row.state.length === 100 ? "..." : ""}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
});

SexTableView.displayName = "SexTableView";
