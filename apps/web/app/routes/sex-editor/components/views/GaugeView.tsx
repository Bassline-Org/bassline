import { memo, useEffect, useState } from "react";
import type { NodeProps } from "@xyflow/react";
import { Handle, Position } from "@xyflow/react";
import styles from "../WorkspaceTree.module.css";

export const GaugeView = memo(({ data, selected }: NodeProps) => {
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

    // Gauge parameters
    const value = typeof state === "number" ? state : 0;
    const min = 0;
    const max = 100; // Could make this configurable via gadget state
    const percentage = Math.min(Math.max((value - min) / (max - min), 0), 1);
    const angle = percentage * 180; // Semi-circle gauge (0-180 degrees)

    // Color based on value
    const getColor = () => {
        if (percentage < 0.33) return "#22c55e"; // Green
        if (percentage < 0.67) return "#eab308"; // Yellow
        return "#ef4444"; // Red
    };

    const color = getColor();

    // SVG gauge
    const radius = 60;
    const strokeWidth = 12;
    const center = 75;
    const circumference = Math.PI * radius; // Semi-circle

    return (
        <div
            className={`bg-white border-2 rounded-lg shadow-lg min-w-[200px] ${
                selected ? "border-orange-500 ring-2 ring-orange-300" : "border-orange-400"
            } ${isFlashing ? styles.flash : ""}`}
        >
            {/* Connection handles */}
            <Handle type="target" position={Position.Top} className="!bg-orange-500" />
            <Handle type="source" position={Position.Bottom} className="!bg-orange-500" />

            {/* Content */}
            <div className="p-6 space-y-2">
                <div className="text-sm font-semibold text-gray-700 text-center">
                    {name}
                </div>

                {/* Semi-circle gauge */}
                <svg width="150" height="100" viewBox="0 0 150 100">
                    {/* Background arc */}
                    <path
                        d={`M ${center - radius} ${center} A ${radius} ${radius} 0 0 1 ${center + radius} ${center}`}
                        fill="none"
                        stroke="#e5e7eb"
                        strokeWidth={strokeWidth}
                        strokeLinecap="round"
                    />
                    {/* Value arc */}
                    <path
                        d={`M ${center - radius} ${center} A ${radius} ${radius} 0 0 1 ${center + radius} ${center}`}
                        fill="none"
                        stroke={color}
                        strokeWidth={strokeWidth}
                        strokeLinecap="round"
                        strokeDasharray={circumference}
                        strokeDashoffset={circumference * (1 - percentage)}
                        style={{ transition: "stroke-dashoffset 0.3s ease" }}
                    />
                    {/* Center value */}
                    <text
                        x={center}
                        y={center + 5}
                        textAnchor="middle"
                        fontSize="24"
                        fontWeight="bold"
                        fill={color}
                    >
                        {value.toFixed(1)}
                    </text>
                    {/* Min/Max labels */}
                    <text
                        x={center - radius}
                        y={center + 20}
                        textAnchor="start"
                        fontSize="10"
                        fill="#9ca3af"
                    >
                        {min}
                    </text>
                    <text
                        x={center + radius}
                        y={center + 20}
                        textAnchor="end"
                        fontSize="10"
                        fill="#9ca3af"
                    >
                        {max}
                    </text>
                </svg>

                <div className="text-xs text-gray-400 font-mono text-center truncate">
                    {gadget.pkg}/{gadget.name}
                </div>
            </div>
        </div>
    );
});

GaugeView.displayName = "GaugeView";
