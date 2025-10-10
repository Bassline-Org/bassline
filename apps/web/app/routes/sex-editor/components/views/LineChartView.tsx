import { memo, useEffect, useState } from "react";
import type { NodeProps } from "@xyflow/react";
import { Handle, Position } from "@xyflow/react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import styles from "../WorkspaceTree.module.css";

export const LineChartView = memo(({ data, selected }: NodeProps) => {
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

    // Prepare chart data
    const chartData = Array.isArray(state) ? state : [];

    // Auto-detect data keys for chart
    const firstItem = chartData[0];
    const valueKey = firstItem && typeof firstItem === "object"
        ? Object.keys(firstItem).find(k => typeof firstItem[k] === "number") || "value"
        : "value";
    const labelKey = firstItem && typeof firstItem === "object"
        ? Object.keys(firstItem).find(k => typeof firstItem[k] === "string") || "name"
        : "name";

    return (
        <div
            className={`bg-white border-2 rounded-lg shadow-lg min-w-[400px] ${
                selected ? "border-blue-500 ring-2 ring-blue-300" : "border-blue-400"
            } ${isFlashing ? styles.flash : ""}`}
        >
            {/* Connection handles */}
            <Handle type="target" position={Position.Top} className="!bg-blue-500" />
            <Handle type="source" position={Position.Bottom} className="!bg-blue-500" />

            {/* Content */}
            <div className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm">{name}</span>
                    <span className="text-xs text-gray-400">
                        {chartData.length} points
                    </span>
                </div>

                {chartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={200}>
                        <LineChart data={chartData}>
                            <XAxis
                                dataKey={labelKey}
                                tick={{ fontSize: 10 }}
                                stroke="#94a3b8"
                            />
                            <YAxis
                                tick={{ fontSize: 10 }}
                                stroke="#94a3b8"
                            />
                            <Tooltip
                                contentStyle={{
                                    fontSize: 12,
                                    backgroundColor: "rgba(255,255,255,0.95)",
                                    border: "1px solid #e2e8f0"
                                }}
                            />
                            <Line
                                type="monotone"
                                dataKey={valueKey}
                                stroke="#3b82f6"
                                strokeWidth={2}
                                dot={{ r: 3 }}
                                activeDot={{ r: 5 }}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="h-[200px] flex items-center justify-center text-gray-400 text-sm">
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

LineChartView.displayName = "LineChartView";
