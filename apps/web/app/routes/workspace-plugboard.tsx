import { useMemo } from "react";
import type { Route } from "./+types/workspace-plugboard";
import { LayeredControl } from "@bassline/parser/control";
import { WorkspaceProvider, Workspace } from "@bassline/parser-react";
import {
    LayerListPanel,
    ReplPanel,
    PlugboardPanel,
} from "@bassline/parser-react/components";

export function meta({}: Route.MetaArgs) {
    return [
        { title: "Plugboard Workspace" },
        {
            name: "description",
            content: "Visual routing workspace with plugboard diagram",
        },
    ];
}

/**
 * Plugboard Workspace - Visual routing diagram workspace
 *
 * Demonstrates workspace with 3 panels:
 * - Top Left (25%): LayerListPanel
 * - Top Right (75%): PlugboardPanel (visual routing diagram)
 * - Bottom (100%): ReplPanel
 *
 * This workspace focuses on visual routing and connection management.
 */
export default function WorkspacePlugboard() {
    // Create LayeredControl instance (could be from useProject in future)
    const lc = useMemo(() => new LayeredControl(), []);

    return (
        <WorkspaceProvider lc={lc}>
            <Workspace>
                <div className="container mx-auto p-6">
                    {/* Header */}
                    <div className="mb-6">
                        <h1 className="text-3xl font-bold mb-2">
                            Plugboard Workspace
                        </h1>
                        <p className="text-muted-foreground">
                            Visual routing diagram for managing LayeredControl
                            connections
                        </p>
                    </div>

                    {/* 2-row layout */}
                    <div className="space-y-6">
                        {/* Top row: LayerList + Plugboard */}
                        <div className="flex gap-6 h-[400px]">
                            {/* Left: LayerListPanel */}
                            <div className="w-[25%] flex flex-col">
                                <div className="flex-1 overflow-hidden">
                                    <LayerListPanel />
                                </div>
                            </div>

                            {/* Right: PlugboardPanel */}
                            <div className="w-[75%] flex flex-col">
                                <div className="flex-1 overflow-hidden rounded-lg border border-slate-200">
                                    <PlugboardPanel />
                                </div>
                            </div>
                        </div>

                        {/* Bottom row: ReplPanel */}
                        <div className="h-[300px]">
                            <ReplPanel />
                        </div>
                    </div>

                    {/* Instructions */}
                    <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                        <h3 className="font-semibold text-blue-900 mb-2">
                            How It Works
                        </h3>
                        <ul className="text-sm text-blue-800 space-y-1">
                            <li>
                                • <strong>Create layers</strong> using the
                                LayerListPanel on the top left
                            </li>
                            <li>
                                • <strong>Visual routing</strong>: Drag from a
                                layer's output (right) to another layer's input
                                (left) to create connections
                            </li>
                            <li>
                                • <strong>Delete connections</strong>: Select an
                                edge and press Delete/Backspace
                            </li>
                            <li>
                                • <strong>Set active layer</strong>: Click a
                                node in the diagram or a layer in the list
                            </li>
                            <li>
                                • <strong>Execute commands</strong>: Use the
                                REPL at the bottom to run commands on the active
                                layer
                            </li>
                            <li>
                                • <strong>Buses</strong>: Create routing-only
                                nodes by calling{" "}
                                <code className="bg-blue-100 px-1 rounded">
                                    lc.addBus("name")
                                </code>
                            </li>
                        </ul>
                    </div>
                </div>
            </Workspace>
        </WorkspaceProvider>
    );
}
