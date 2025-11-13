/**
 * RuleBuilderPanel - Visual graph rewrite rule builder
 *
 * Build rules as graph morphisms using ReactFlow groups:
 * - Pattern group (WHERE clause)
 * - Production group (PRODUCE clause)
 * - NAC groups (blocking patterns)
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
    addEdge,
    Background,
    Controls,
    ReactFlow,
    useEdgesState,
    useNodesState,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { useLayeredControl, useLayers } from "../hooks/useLayeredControl.jsx";
import { GroupNode } from "./rule-builder/nodes/GroupNode.jsx";
import { VariableNode } from "./rule-builder/nodes/VariableNode.jsx";
import { LiteralNode } from "./rule-builder/nodes/LiteralNode.jsx";
import { WildcardNode } from "./rule-builder/nodes/WildcardNode.jsx";
import { ChainEdge } from "./rule-builder/edges/ChainEdge.jsx";
import { ContextMenu } from "./rule-builder/components/ContextMenu.jsx";
import {
    compileToQuads,
    validateRule,
} from "./rule-builder/utils/compileToQuads.js";
import { validateChains } from "./rule-builder/utils/chainValidation.js";

const nodeTypes = {
    patternGroup: GroupNode,
    variable: VariableNode,
    literal: LiteralNode,
    wildcard: WildcardNode,
};

const edgeTypes = {
    chain: ChainEdge,
};

// Initial nodes: pattern, production, and NAC groups + sample rule
const initialNodes = [
    {
        id: "pattern-group",
        type: "patternGroup",
        position: { x: 50, y: 50 },
        data: { label: "Pattern (WHERE)", color: "blue", context: "*" },
        style: { width: 800, height: 900 },
        draggable: false,
        selectable: false,
        zIndex: 0,
    },
    {
        id: "production-group",
        type: "patternGroup",
        position: { x: 870, y: 50 },
        data: { label: "Production (PRODUCE)", color: "green", context: "*" },
        style: { width: 800, height: 900 },
        draggable: false,
        selectable: false,
        zIndex: 0,
    },
    {
        id: "nac-group",
        type: "patternGroup",
        position: { x: 1690, y: 50 },
        data: { label: "NAC (Negative Pattern)", color: "red", context: "*" },
        style: { width: 800, height: 900 },
        draggable: false,
        selectable: false,
        zIndex: 0,
    },
    // Sample rule: ?person age ?a * => ?person adult true *
    // Pattern nodes
    {
        id: "sample-p-0",
        type: "variable",
        position: { x: 40, y: 150 },
        data: { label: "?person" },
        parentId: "pattern-group",
        draggable: true,
        zIndex: 100,
        style: {
            width: 80,
            height: 80,
            padding: 0,
            border: "none",
            background: "transparent",
        },
    },
    {
        id: "sample-p-1",
        type: "literal",
        position: { x: 160, y: 150 },
        data: { label: "age", literalType: "word" },
        parentId: "pattern-group",
        draggable: true,
        zIndex: 100,
        style: {
            width: 80,
            height: 80,
            padding: 0,
            border: "none",
            background: "transparent",
        },
    },
    {
        id: "sample-p-2",
        type: "variable",
        position: { x: 300, y: 150 },
        data: { label: "?a" },
        parentId: "pattern-group",
        draggable: true,
        zIndex: 100,
        style: {
            width: 80,
            height: 80,
            padding: 0,
            border: "none",
            background: "transparent",
        },
    },
    {
        id: "sample-p-3",
        type: "wildcard",
        position: { x: 420, y: 150 },
        data: { label: "*" },
        parentId: "pattern-group",
        draggable: true,
        zIndex: 100,
        style: {
            width: 80,
            height: 80,
            padding: 0,
            border: "none",
            background: "transparent",
        },
    },
    // Production nodes
    {
        id: "sample-prod-0",
        type: "variable",
        position: { x: 40, y: 150 },
        data: { label: "?person" },
        parentId: "production-group",
        draggable: true,
        zIndex: 100,
        style: {
            width: 80,
            height: 80,
            padding: 0,
            border: "none",
            background: "transparent",
        },
    },
    {
        id: "sample-prod-1",
        type: "literal",
        position: { x: 160, y: 150 },
        data: { label: "adult", literalType: "word" },
        parentId: "production-group",
        draggable: true,
        zIndex: 100,
        style: {
            width: 80,
            height: 80,
            padding: 0,
            border: "none",
            background: "transparent",
        },
    },
    {
        id: "sample-prod-2",
        type: "literal",
        position: { x: 300, y: 150 },
        data: { label: "true", literalType: "word" },
        parentId: "production-group",
        draggable: true,
        zIndex: 100,
        style: {
            width: 80,
            height: 80,
            padding: 0,
            border: "none",
            background: "transparent",
        },
    },
    {
        id: "sample-prod-3",
        type: "wildcard",
        position: { x: 440, y: 150 },
        data: { label: "*" },
        parentId: "production-group",
        draggable: true,
        zIndex: 100,
        style: {
            width: 80,
            height: 80,
            padding: 0,
            border: "none",
            background: "transparent",
        },
    },
];

const initialEdges = [
    // Pattern edges
    {
        id: "sample-p-edge-0",
        source: "sample-p-0",
        target: "sample-p-1",
        type: "chain",
        zIndex: 50,
    },
    {
        id: "sample-p-edge-1",
        source: "sample-p-1",
        target: "sample-p-2",
        type: "chain",
        zIndex: 50,
    },
    {
        id: "sample-p-edge-2",
        source: "sample-p-2",
        target: "sample-p-3",
        type: "chain",
        zIndex: 50,
    },
    // Production edges
    {
        id: "sample-prod-edge-0",
        source: "sample-prod-0",
        target: "sample-prod-1",
        type: "chain",
        zIndex: 50,
    },
    {
        id: "sample-prod-edge-1",
        source: "sample-prod-1",
        target: "sample-prod-2",
        type: "chain",
        zIndex: 50,
    },
    {
        id: "sample-prod-edge-2",
        source: "sample-prod-2",
        target: "sample-prod-3",
        type: "chain",
        zIndex: 50,
    },
];

export function RuleBuilderPanel() {
    const lc = useLayeredControl();
    const layers = useLayers();
    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

    const [contextMenu, setContextMenu] = useState(null);
    const [ruleName, setRuleName] = useState("");
    const [targetLayer, setTargetLayer] = useState("");
    const [nodeCounter, setNodeCounter] = useState(0);
    const panelRef = useRef(null);

    // Auto-select first layer when layers change
    useEffect(() => {
        if (!targetLayer && layers.length > 0) {
            setTargetLayer(layers[0]);
        }
    }, [layers, targetLayer]);

    // Handle edge connection
    // Edges now connect nodes in 4-node chains (S→A→T→C)
    const onConnect = useCallback(
        (params) => {
            setEdges((eds) =>
                addEdge(
                    {
                        ...params,
                        type: "chain",
                        zIndex: 50,
                    },
                    eds,
                )
            );
        },
        [setEdges],
    );

    // Context menu handler
    const onNodeContextMenu = useCallback(
        (event, node) => {
            event.preventDefault();

            // Only show context menu for group nodes
            if (node.type !== "patternGroup") return;

            // Calculate position relative to the panel container
            if (panelRef.current) {
                const rect = panelRef.current.getBoundingClientRect();
                setContextMenu({
                    groupId: node.id,
                    groupLabel: node.data.label,
                    x: event.clientX - rect.left,
                    y: event.clientY - rect.top,
                });
            }
        },
        [setContextMenu],
    );

    // Add variable to palette (no parent)
    const addVariable = useCallback(() => {
        const label = prompt("Enter variable name (e.g., ?person):", "?x");
        if (!label) return;

        const id = `var-${nodeCounter}`;
        setNodeCounter((c) => c + 1);

        // Calculate position in palette (stack vertically)
        const paletteVariables = nodes.filter(
            (n) => n.type === "variable" && !n.parentId,
        );
        const yOffset = paletteVariables.length * 100;

        const newNode = {
            id,
            type: "variable",
            position: { x: 800, y: 100 + yOffset }, // Absolute position in palette
            data: { label },
            // NO parentId - this is a palette variable
            draggable: true,
            zIndex: 100,
            style: {
                width: 80,
                height: 80,
                padding: 0,
                border: "none",
                background: "transparent",
            },
        };

        setNodes((nds) => [...nds, newNode]);
    }, [nodeCounter, nodes, setNodes]);

    // Add node to specific group
    const addNode = useCallback(
        (type, targetGroupId) => {
            const id = `node-${nodeCounter}`;
            setNodeCounter((c) => c + 1);

            let label = "";
            let literalType = null;

            if (type === "variable") {
                label = prompt("Enter variable name (e.g., ?person):", "?x");
                if (!label) return;
                // Ensure variable starts with ?
                if (!label.startsWith("?")) {
                    label = "?" + label;
                }
            } else if (type === "word") {
                label = prompt("Enter word (e.g., age, name):", "age");
                literalType = "word";
            } else if (type === "number") {
                label = prompt("Enter number (e.g., 30, 25):", "30");
                literalType = "number";
            } else if (type === "string") {
                label = prompt('Enter string (e.g., "John Doe"):', '"value"');
                literalType = "string";
            } else if (type === "wildcard") {
                label = "*";
            }

            if (!label) return;

            // Map word/number/string to literal type for node rendering
            const nodeType =
                (type === "word" || type === "number" || type === "string")
                    ? "literal"
                    : type;

            // Determine node dimensions based on type
            const nodeStyle = {
                width: 80,
                height: 80,
                padding: 0,
                border: "none",
                background: "transparent",
            }; // All nodes are now the same size

            const newNode = {
                id,
                type: nodeType,
                position: { x: 100, y: 100 }, // Relative to parent
                data: { label, literalType },
                parentId: targetGroupId,
                draggable: true,
                zIndex: 100,
                style: nodeStyle,
            };

            setNodes((nds) => [...nds, newNode]);
        },
        [nodeCounter, setNodes],
    );

    // Quick Quad - creates a pre-connected 4-node chain
    const createQuickQuad = useCallback((targetGroupId) => {
        const baseId = nodeCounter;
        setNodeCounter((c) => c + 4);

        // Create 4 nodes: Subject, Attribute, Target, Context
        const spacing = 120;
        const startY = 150;

        const newNodes = [
            {
                id: `node-${baseId}`,
                type: "variable",
                position: { x: 40, y: startY },
                data: { label: "?s" },
                parentId: targetGroupId,
                draggable: true,
                zIndex: 100,
                style: {
                    width: 80,
                    height: 80,
                    padding: 0,
                    border: "none",
                    background: "transparent",
                },
            },
            {
                id: `node-${baseId + 1}`,
                type: "variable",
                position: { x: 40 + spacing, y: startY },
                data: { label: "?a" },
                parentId: targetGroupId,
                draggable: true,
                zIndex: 100,
                style: {
                    width: 80,
                    height: 80,
                    padding: 0,
                    border: "none",
                    background: "transparent",
                },
            },
            {
                id: `node-${baseId + 2}`,
                type: "variable",
                position: { x: 40 + spacing * 2, y: startY },
                data: { label: "?t" },
                parentId: targetGroupId,
                draggable: true,
                zIndex: 100,
                style: {
                    width: 80,
                    height: 80,
                    padding: 0,
                    border: "none",
                    background: "transparent",
                },
            },
            {
                id: `node-${baseId + 3}`,
                type: "wildcard",
                position: { x: 40 + spacing * 3, y: startY },
                data: { label: "*" },
                parentId: targetGroupId,
                draggable: true,
                zIndex: 100,
                style: {
                    width: 80,
                    height: 80,
                    padding: 0,
                    border: "none",
                    background: "transparent",
                },
            },
        ];

        // Create 3 edges connecting the 4 nodes
        const newEdges = [
            {
                id: `edge-${baseId}-0`,
                source: `node-${baseId}`,
                target: `node-${baseId + 1}`,
                type: "chain",
                zIndex: 50,
            },
            {
                id: `edge-${baseId}-1`,
                source: `node-${baseId + 1}`,
                target: `node-${baseId + 2}`,
                type: "chain",
                zIndex: 50,
            },
            {
                id: `edge-${baseId}-2`,
                source: `node-${baseId + 2}`,
                target: `node-${baseId + 3}`,
                type: "chain",
                zIndex: 50,
            },
        ];

        setNodes((nds) => [...nds, ...newNodes]);
        setEdges((eds) => [...eds, ...newEdges]);
    }, [nodeCounter, setNodes, setEdges]);

    // Install rule
    const installRule = useCallback(() => {
        if (!ruleName.trim()) {
            alert("Please enter a rule name");
            return;
        }

        if (!targetLayer) {
            alert("Please select a target layer");
            return;
        }

        const { patternQuads, productionQuads, nacQuads } = compileToQuads(
            nodes,
            edges,
        );

        // Validate (pass nodes for palette variable checking)
        const validation = validateRule(patternQuads, productionQuads, nodes);
        if (!validation.valid) {
            alert("Validation errors:\n" + validation.errors.join("\n"));
            return;
        }

        if (patternQuads.length === 0) {
            alert("Pattern (WHERE) must have at least one quad");
            return;
        }

        if (productionQuads.length === 0) {
            alert("Production (PRODUCE) must have at least one quad");
            return;
        }

        // Get layer's control
        const layer = lc.getLayer(targetLayer)?.control;
        if (!layer) {
            alert(`Layer "${targetLayer}" not found`);
            return;
        }

        try {
            // Format rule command
            let ruleCommand;
            if (nacQuads.length > 0) {
                // With NAC
                ruleCommand = `rule ${ruleName} where { ${
                    patternQuads.join(" ")
                } | not ${nacQuads.join(" ")} } produce { ${
                    productionQuads.join(" ")
                } }`;
            } else {
                // Without NAC
                ruleCommand = `rule ${ruleName} where { ${
                    patternQuads.join(" ")
                } } produce { ${productionQuads.join(" ")} }`;
            }

            // Install rule into layer
            layer.run(ruleCommand);

            alert(
                `Rule "${ruleName}" installed successfully into "${targetLayer}"!\n\nPattern:\n${
                    patternQuads.join("\n")
                }\n\nProduction:\n${productionQuads.join("\n")}${
                    nacQuads.length > 0
                        ? `\n\nNAC:\n${nacQuads.join("\n")}`
                        : ""
                }`,
            );
        } catch (err) {
            console.error("[RuleBuilder] Rule installation failed:", err);
            alert(`Failed to install rule: ${err.message}`);
        }
    }, [ruleName, targetLayer, nodes, edges, lc]);

    // Compute validation for each group
    const patternNodes = nodes.filter((n) => n.parentId === "pattern-group");
    const productionNodes = nodes.filter((n) =>
        n.parentId === "production-group"
    );
    const nacNodes = nodes.filter((n) => n.parentId === "nac-group");

    const patternValidation = validateChains(patternNodes, edges);
    const productionValidation = validateChains(productionNodes, edges);
    const nacValidation = validateChains(nacNodes, edges);

    return (
        <div ref={panelRef} className="h-full flex flex-col relative">
            {/* Toolbar */}
            <div className="flex-none bg-white border-b border-gray-200 p-3 flex flex-wrap items-center gap-2">
                {/* Instructions */}
                <div className="text-sm text-gray-500 italic">
                    Right-click groups to add nodes. Connect 4 nodes in
                    sequence: Subject → Attribute → Target → Context
                </div>

                {/* Validation Summary */}
                <div className="flex items-center gap-2 text-xs">
                    <span
                        className={`px-2 py-1 rounded ${
                            patternValidation.valid
                                ? "bg-green-100 text-green-700"
                                : "bg-red-100 text-red-700"
                        }`}
                    >
                        Pattern: {patternValidation.validChainCount}{" "}
                        quad{patternValidation.validChainCount !== 1 ? "s" : ""}
                    </span>
                    <span
                        className={`px-2 py-1 rounded ${
                            productionValidation.valid
                                ? "bg-green-100 text-green-700"
                                : "bg-red-100 text-red-700"
                        }`}
                    >
                        Production: {productionValidation.validChainCount}{" "}
                        quad{productionValidation.validChainCount !== 1
                            ? "s"
                            : ""}
                    </span>
                    {nacValidation.validChainCount > 0 && (
                        <span
                            className={`px-2 py-1 rounded ${
                                nacValidation.valid
                                    ? "bg-green-100 text-green-700"
                                    : "bg-red-100 text-red-700"
                            }`}
                        >
                            NAC: {nacValidation.validChainCount}{" "}
                            quad{nacValidation.validChainCount !== 1 ? "s" : ""}
                        </span>
                    )}
                </div>

                <div className="flex-1" /> {/* Spacer */}

                {/* Add Variable to Palette */}
                <button
                    onClick={addVariable}
                    className="px-3 py-1 text-sm bg-purple-500 text-white rounded hover:bg-purple-600"
                    title="Add variable to palette for cross-group connections"
                >
                    + Palette Variable
                </button>

                <div className="w-px h-6 bg-gray-300" />

                {/* Layer Selection */}
                <select
                    value={targetLayer}
                    onChange={(e) => setTargetLayer(e.target.value)}
                    className="px-3 py-1 text-sm border border-gray-300 rounded bg-white"
                    title="Target layer for rule installation"
                >
                    <option value="">-- Select Layer --</option>
                    {layers.map((name) => (
                        <option key={name} value={name}>
                            {name}
                        </option>
                    ))}
                </select>

                {/* Rule Name and Install */}
                <input
                    type="text"
                    placeholder="Rule name..."
                    value={ruleName}
                    onChange={(e) => setRuleName(e.target.value)}
                    className="px-3 py-1 text-sm border border-gray-300 rounded w-40"
                />
                <button
                    onClick={installRule}
                    className="px-4 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 font-medium"
                    disabled={!targetLayer || !ruleName.trim()}
                >
                    Install Rule
                </button>
            </div>

            {/* ReactFlow Canvas */}
            <div className="flex-1">
                <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onConnect={onConnect}
                    onNodeContextMenu={onNodeContextMenu}
                    nodeTypes={nodeTypes}
                    edgeTypes={edgeTypes}
                    elevateNodesOnSelect={false}
                    selectNodesOnDrag={false}
                    nodesDraggable={true}
                    nodesConnectable={true}
                    fitView
                >
                    <Background />
                    <Controls />
                </ReactFlow>
            </div>

            {/* Context Menu */}
            {contextMenu && (
                <ContextMenu
                    position={{ x: contextMenu.x, y: contextMenu.y }}
                    groupLabel={contextMenu.groupLabel}
                    onClose={() => setContextMenu(null)}
                    onAddNode={(type) => addNode(type, contextMenu.groupId)}
                    onQuickQuad={() => createQuickQuad(contextMenu.groupId)}
                />
            )}
        </div>
    );
}
