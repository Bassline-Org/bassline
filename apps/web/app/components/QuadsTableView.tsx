import { useMemo, useState } from "react";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "~/components/ui/table";
import { Input } from "~/components/ui/input";

interface QuadsTableViewProps {
    quads: any[];
}

type EntityRow = {
    entity: string;
    attributes: Record<string, string>;
    contexts: string[];
};

type SortDirection = "asc" | "desc";

export function QuadsTableView({ quads }: QuadsTableViewProps) {
    const [searchTerm, setSearchTerm] = useState("");
    const [sortColumn, setSortColumn] = useState<string>("entity");
    const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

    // Extract all unique attributes and build entity map
    const { entityRows, attributeColumns } = useMemo(() => {
        const entityMap = new Map<string, { attributes: Map<string, Set<string>>, contexts: Set<string> }>();
        const attributesSet = new Set<string>();

        // Process quads
        for (const quad of quads) {
            const [entity, attribute, value, context] = quad.values;
            const entityStr = entity?.spelling?.description || String(entity);
            const attrStr = attribute?.spelling?.description || String(attribute);
            const valueStr = value?.spelling?.description || String(value);
            const contextStr = context?.spelling?.description || String(context);

            // Track unique attributes
            attributesSet.add(attrStr);

            // Build entity map
            if (!entityMap.has(entityStr)) {
                entityMap.set(entityStr, {
                    attributes: new Map(),
                    contexts: new Set()
                });
            }

            const entityData = entityMap.get(entityStr)!;

            // Add value to attribute (may have multiple values)
            if (!entityData.attributes.has(attrStr)) {
                entityData.attributes.set(attrStr, new Set());
            }
            entityData.attributes.get(attrStr)!.add(valueStr);

            // Track contexts
            entityData.contexts.add(contextStr);
        }

        // Convert to rows
        const rows: EntityRow[] = Array.from(entityMap.entries()).map(([entity, data]) => {
            const attributes: Record<string, string> = {};

            // Convert attribute sets to comma-separated strings
            data.attributes.forEach((values, attr) => {
                attributes[attr] = Array.from(values).join(", ");
            });

            return {
                entity,
                attributes,
                contexts: Array.from(data.contexts)
            };
        });

        return {
            entityRows: rows,
            attributeColumns: Array.from(attributesSet).sort()
        };
    }, [quads]);

    // Filter rows based on search
    const filteredRows = useMemo(() => {
        if (!searchTerm.trim()) return entityRows;

        const term = searchTerm.toLowerCase();
        return entityRows.filter((row) => {
            // Check entity
            if (row.entity.toLowerCase().includes(term)) return true;

            // Check all attribute values
            for (const value of Object.values(row.attributes)) {
                if (value.toLowerCase().includes(term)) return true;
            }

            // Check contexts
            if (row.contexts.some(ctx => ctx.toLowerCase().includes(term))) return true;

            return false;
        });
    }, [entityRows, searchTerm]);

    // Sort rows
    const sortedRows = useMemo(() => {
        const sorted = [...filteredRows];
        sorted.sort((a, b) => {
            let aVal: string;
            let bVal: string;

            if (sortColumn === "entity") {
                aVal = a.entity;
                bVal = b.entity;
            } else if (sortColumn === "context") {
                aVal = a.contexts.join(", ");
                bVal = b.contexts.join(", ");
            } else {
                // Sort by attribute column
                aVal = a.attributes[sortColumn] || "";
                bVal = b.attributes[sortColumn] || "";
            }

            const comparison = aVal.localeCompare(bVal);
            return sortDirection === "asc" ? comparison : -comparison;
        });
        return sorted;
    }, [filteredRows, sortColumn, sortDirection]);

    const handleHeaderClick = (column: string) => {
        if (sortColumn === column) {
            setSortDirection(sortDirection === "asc" ? "desc" : "asc");
        } else {
            setSortColumn(column);
            setSortDirection("asc");
        }
    };

    const getSortIndicator = (column: string) => {
        if (sortColumn !== column) return null;
        return sortDirection === "asc" ? " ↑" : " ↓";
    };

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <Input
                    placeholder="Search quads..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="max-w-sm text-sm"
                />
                <div className="text-sm text-slate-600">
                    {sortedRows.length} entit{sortedRows.length !== 1 ? "ies" : "y"}
                </div>
            </div>

            <div className="border rounded-lg bg-white overflow-auto max-h-[600px]">
                <Table>
                    <TableHeader>
                        <TableRow>
                            {/* Entity column */}
                            <TableHead
                                className="cursor-pointer hover:bg-slate-50 sticky left-0 bg-white z-10"
                                onClick={() => handleHeaderClick("entity")}
                            >
                                Entity{getSortIndicator("entity")}
                            </TableHead>

                            {/* Dynamic attribute columns */}
                            {attributeColumns.map((attr) => (
                                <TableHead
                                    key={attr}
                                    className="cursor-pointer hover:bg-slate-50"
                                    onClick={() => handleHeaderClick(attr)}
                                >
                                    {attr}{getSortIndicator(attr)}
                                </TableHead>
                            ))}

                            {/* Context column */}
                            <TableHead
                                className="cursor-pointer hover:bg-slate-50"
                                onClick={() => handleHeaderClick("context")}
                            >
                                context{getSortIndicator("context")}
                            </TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {sortedRows.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={attributeColumns.length + 2} className="text-center text-slate-500">
                                    No entities to display
                                </TableCell>
                            </TableRow>
                        ) : (
                            sortedRows.map((row, idx) => (
                                <TableRow key={`${row.entity}-${idx}`} className="font-mono text-xs">
                                    {/* Entity cell - sticky */}
                                    <TableCell className="font-medium sticky left-0 bg-white">
                                        {row.entity}
                                    </TableCell>

                                    {/* Attribute value cells */}
                                    {attributeColumns.map((attr) => (
                                        <TableCell key={attr} className="text-slate-700">
                                            {row.attributes[attr] || ""}
                                        </TableCell>
                                    ))}

                                    {/* Context cell */}
                                    <TableCell className="text-slate-500">
                                        {row.contexts.join(", ")}
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
