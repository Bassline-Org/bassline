import { memo, useState, useEffect } from "react";
import type { NodeProps } from "@xyflow/react";
import { Button } from "~/components/ui/button";

interface Item {
    id: string;
    value: any;
    type: "string" | "number" | "boolean" | "json";
}

export const ArrayEditorView = memo(({ data, selected }: NodeProps) => {
    const { name, gadget } = data;
    const rawValue = gadget.useCurrent();

    // Ensure value is always an array
    const value = Array.isArray(rawValue) ? rawValue : [];

    // Convert array to items
    const arrayToItems = (arr: any[]): Item[] => {
        if (!Array.isArray(arr)) return [];
        return arr.map((val, idx) => ({
            id: `${idx}-${Math.random().toString(36).slice(2)}`,
            value: val,
            type: inferType(val),
        }));
    };

    const inferType = (val: any): Item["type"] => {
        if (typeof val === "number") return "number";
        if (typeof val === "boolean") return "boolean";
        if (typeof val === "string") return "string";
        return "json";
    };

    const [items, setItems] = useState<Item[]>(() => arrayToItems(value));

    // Sync items when gadget state changes externally
    useEffect(() => {
        setItems(arrayToItems(value));
    }, [value]);

    const itemsToArray = (items: Item[]): any[] => {
        return items.map(item => item.value);
    };

    const handleAddItem = () => {
        const newItem: Item = {
            id: Math.random().toString(36).slice(2),
            value: "",
            type: "string",
        };
        const newItems = [...items, newItem];
        setItems(newItems);
    };

    const handleDeleteItem = (id: string) => {
        const newItems = items.filter(item => item.id !== id);
        setItems(newItems);
        gadget.receive(itemsToArray(newItems));
    };

    const handleValueChange = (id: string, newValue: string) => {
        const newItems = items.map(item => {
            if (item.id !== id) return item;

            let parsedValue: any = newValue;
            switch (item.type) {
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

            return { ...item, value: parsedValue };
        });
        setItems(newItems);
    };

    const handleTypeChange = (id: string, newType: Item["type"]) => {
        const newItems = items.map(item => {
            if (item.id !== id) return item;

            // Convert value to new type
            let convertedValue: any = item.value;
            switch (newType) {
                case "number":
                    convertedValue = Number(item.value) || 0;
                    break;
                case "boolean":
                    convertedValue = Boolean(item.value);
                    break;
                case "string":
                    convertedValue = String(item.value);
                    break;
                case "json":
                    convertedValue = item.value;
                    break;
            }

            return { ...item, type: newType, value: convertedValue };
        });
        setItems(newItems);
    };

    const handleBlur = () => {
        gadget.receive(itemsToArray(items));
    };

    const handleMoveUp = (id: string) => {
        const idx = items.findIndex(item => item.id === id);
        if (idx <= 0) return;
        const newItems = [...items];
        [newItems[idx - 1], newItems[idx]] = [newItems[idx], newItems[idx - 1]];
        setItems(newItems);
        gadget.receive(itemsToArray(newItems));
    };

    const handleMoveDown = (id: string) => {
        const idx = items.findIndex(item => item.id === id);
        if (idx < 0 || idx >= items.length - 1) return;
        const newItems = [...items];
        [newItems[idx], newItems[idx + 1]] = [newItems[idx + 1], newItems[idx]];
        setItems(newItems);
        gadget.receive(itemsToArray(newItems));
    };

    return (
        <div className="p-2">
            {items.length === 0 ? (
                <div className="text-center py-4">
                    <div className="text-gray-500 text-sm mb-2">Empty array</div>
                    <Button size="sm" onClick={handleAddItem}>
                        Add First Item
                    </Button>
                </div>
            ) : (
                <>
                    <div className="bg-orange-50 px-2 py-1 flex items-center text-xs font-semibold text-orange-600 border rounded-t">
                        <div className="w-8">#</div>
                        <div className="flex-1">Value</div>
                        <div className="w-20">Type</div>
                        <div className="w-16"></div>
                    </div>
                    <div className="divide-y border-l border-r max-h-96 overflow-auto">
                        {items.map((item, idx) => {
                            const displayValue = item.type === "json"
                                ? JSON.stringify(item.value)
                                : item.type === "boolean"
                                    ? String(item.value)
                                    : item.value;

                            return (
                                <div key={item.id} className="flex items-center p-2 gap-2 hover:bg-orange-50">
                                    <div className="w-8 text-xs text-gray-500 font-mono">{idx}</div>
                                    {item.type === "boolean" ? (
                                        <select
                                            value={String(item.value)}
                                            onChange={(e) => handleValueChange(item.id, e.target.value)}
                                            onBlur={handleBlur}
                                            className="flex-1 px-2 py-1 text-sm border rounded"
                                        >
                                            <option value="true">true</option>
                                            <option value="false">false</option>
                                        </select>
                                    ) : (
                                        <input
                                            type={item.type === "number" ? "number" : "text"}
                                            value={displayValue}
                                            onChange={(e) => handleValueChange(item.id, e.target.value)}
                                            onBlur={handleBlur}
                                            placeholder="value"
                                            className="flex-1 px-2 py-1 text-sm border rounded font-mono"
                                        />
                                    )}
                                    <select
                                        value={item.type}
                                        onChange={(e) => handleTypeChange(item.id, e.target.value as Item["type"])}
                                        className="w-20 px-1 py-1 text-xs border rounded"
                                    >
                                        <option value="string">str</option>
                                        <option value="number">num</option>
                                        <option value="boolean">bool</option>
                                        <option value="json">json</option>
                                    </select>
                                    <div className="w-16 flex gap-1">
                                        <button
                                            onClick={() => handleMoveUp(item.id)}
                                            disabled={idx === 0}
                                            className="w-6 h-6 flex items-center justify-center text-orange-600 hover:bg-orange-100 rounded disabled:text-gray-300 disabled:cursor-not-allowed"
                                            title="Move up"
                                        >
                                            ↑
                                        </button>
                                        <button
                                            onClick={() => handleMoveDown(item.id)}
                                            disabled={idx === items.length - 1}
                                            className="w-6 h-6 flex items-center justify-center text-orange-600 hover:bg-orange-100 rounded disabled:text-gray-300 disabled:cursor-not-allowed"
                                            title="Move down"
                                        >
                                            ↓
                                        </button>
                                        <button
                                            onClick={() => handleDeleteItem(item.id)}
                                            className="w-6 h-6 flex items-center justify-center text-red-600 hover:bg-red-50 rounded"
                                            title="Delete"
                                        >
                                            ×
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    <div className="p-2 border-l border-r border-b bg-orange-50 rounded-b">
                        <Button size="sm" onClick={handleAddItem} className="w-full">
                            + Add Item
                        </Button>
                    </div>
                </>
            )}
        </div>
    );
});

ArrayEditorView.displayName = "ArrayEditorView";
