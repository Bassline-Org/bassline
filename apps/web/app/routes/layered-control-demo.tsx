import { useEffect, useState } from "react";
import type { Route } from "./+types/layered-control-demo";
import { LayeredControl } from "@bassline/parser/control";
import { LayeredControlProvider } from "@bassline/parser-react/hooks";
import {
    useLayeredControl,
    useLayers,
    useRouting,
    useStaging,
    useCommits,
    useBranches,
} from "@bassline/parser-react/hooks";

export function meta({}: Route.MetaArgs) {
    return [
        { title: "LayeredControl React Hooks Demo" },
        {
            name: "description",
            content: "Demo of reactive LayeredControl hooks",
        },
    ];
}

// Module-level singleton LayeredControl
const lc = new LayeredControl();

export default function LayeredControlDemo() {
    return (
        <LayeredControlProvider value={lc}>
            <div className="min-h-screen bg-background p-8">
                <div className="max-w-7xl mx-auto space-y-8">
                    <div>
                        <h1 className="text-4xl font-bold mb-2">
                            LayeredControl React Hooks Demo
                        </h1>
                        <p className="text-muted-foreground">
                            Interactive demonstration of reactive LayeredControl
                            hooks using useSyncExternalStore
                        </p>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <LayerOverview />
                        <AddLayerCard />
                    </div>

                    <LayersList />
                </div>
            </div>
        </LayeredControlProvider>
    );
}

function LayerOverview() {
    const layers = useLayers();
    const routing = useRouting();

    return (
        <div className="border rounded-lg p-6 bg-card">
            <h2 className="text-2xl font-semibold mb-4">Overview</h2>
            <div className="space-y-2">
                <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Layers:</span>
                    <span className="font-mono font-semibold">
                        {layers.length}
                    </span>
                </div>
                <div className="flex justify-between">
                    <span className="text-muted-foreground">Connections:</span>
                    <span className="font-mono font-semibold">
                        {routing.length}
                    </span>
                </div>
                {routing.length > 0 && (
                    <div className="mt-4">
                        <h3 className="text-sm font-medium mb-2">Routing:</h3>
                        <pre className="text-xs bg-muted p-2 rounded overflow-auto">
                            {JSON.stringify(routing, null, 2)}
                        </pre>
                    </div>
                )}
            </div>
        </div>
    );
}

function AddLayerCard() {
    const lc = useLayeredControl();
    const [name, setName] = useState("");

    const handleAdd = () => {
        if (name.trim()) {
            try {
                lc.addLayer(name);
                setName("");
            } catch (err) {
                alert(`Error: ${err.message}`);
            }
        }
    };

    return (
        <div className="border rounded-lg p-6 bg-card">
            <h2 className="text-2xl font-semibold mb-4">Add Layer</h2>
            <div className="flex gap-2">
                <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                    placeholder="Layer name"
                    className="flex-1 px-3 py-2 border rounded-md bg-background"
                />
                <button
                    onClick={handleAdd}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
                >
                    Add Layer
                </button>
            </div>
        </div>
    );
}

function LayersList() {
    const layers = useLayers();

    if (layers.length === 0) {
        return (
            <div className="border rounded-lg p-8 text-center bg-card">
                <p className="text-muted-foreground">
                    No layers yet. Add one above to get started!
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <h2 className="text-2xl font-semibold">Layers</h2>
            <div className="space-y-4">
                {layers.map((name) => (
                    <LayerCard key={name} name={name} />
                ))}
            </div>
        </div>
    );
}

function LayerCard({ name }: { name: string }) {
    const lc = useLayeredControl();
    const staging = useStaging(name);
    const commits = useCommits(name);
    const branches = useBranches(name);
    const [showDetails, setShowDetails] = useState(false);
    const [command, setCommand] = useState("");

    const layer = lc.getLayer(name)?.control;

    const handleRunCommand = () => {
        if (command.trim() && layer) {
            try {
                layer.run(command);
                setCommand("");
            } catch (err) {
                alert(`Error: ${err.message}`);
            }
        }
    };

    const handleCommit = () => {
        const message = prompt("Commit message:");
        if (message) {
            lc.commit(name, message);
        }
    };

    const handleCreateBranch = () => {
        const branchName = prompt("Branch name:");
        if (branchName) {
            try {
                lc.createBranch(name, branchName);
                lc.switchBranch(name, branchName);
            } catch (err) {
                alert(`Error: ${err.message}`);
            }
        }
    };

    return (
        <div className="border rounded-lg p-6 bg-card">
            <div className="flex justify-between items-center mb-4">
                <div>
                    <h3 className="text-xl font-semibold">{name}</h3>
                    <div className="flex gap-3 text-sm text-muted-foreground mt-1">
                        {branches.current && (
                            <span className="font-mono">
                                Branch: {branches.current}
                            </span>
                        )}
                        {staging.hasChanges ? (
                            <span className="text-orange-500 font-medium">
                                {staging.count} staged changes
                            </span>
                        ) : (
                            <span className="text-green-500 font-medium">
                                Clean
                            </span>
                        )}
                        <span>{commits.length} commits</span>
                    </div>
                </div>
                <button
                    onClick={() => setShowDetails(!showDetails)}
                    className="px-4 py-2 border rounded-md hover:bg-accent"
                >
                    {showDetails ? "Hide" : "Show"} Details
                </button>
            </div>

            {showDetails && (
                <div className="space-y-6 pt-4 border-t">
                    {/* Command Input */}
                    <div>
                        <h4 className="text-sm font-medium mb-2">
                            Run Command
                        </h4>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={command}
                                onChange={(e) => setCommand(e.target.value)}
                                onKeyDown={(e) =>
                                    e.key === "Enter" && handleRunCommand()
                                }
                                placeholder="insert { alice age 30 system }"
                                className="flex-1 px-3 py-2 border rounded-md bg-background font-mono text-sm"
                            />
                            <button
                                onClick={handleRunCommand}
                                className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
                            >
                                Run
                            </button>
                        </div>
                    </div>

                    {/* Commit Button */}
                    {staging.hasChanges && (
                        <div>
                            <button
                                onClick={handleCommit}
                                className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
                            >
                                Commit {staging.count} changes
                            </button>
                        </div>
                    )}

                    {/* Branches */}
                    <div>
                        <h4 className="text-sm font-medium mb-2">
                            Branches ({branches.branches.length})
                        </h4>
                        {branches.branches.length > 0 ? (
                            <div className="flex gap-2 flex-wrap">
                                {branches.branches.map((branch) => (
                                    <button
                                        key={branch}
                                        onClick={() =>
                                            lc.switchBranch(name, branch)
                                        }
                                        className={`px-3 py-1 border rounded-md text-sm ${
                                            branch === branches.current
                                                ? "bg-primary text-primary-foreground"
                                                : "hover:bg-accent"
                                        }`}
                                    >
                                        {branch}
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-muted-foreground">
                                No branches yet
                            </p>
                        )}
                        <button
                            onClick={handleCreateBranch}
                            className="mt-2 px-3 py-1 border rounded-md text-sm hover:bg-accent"
                        >
                            + Create Branch
                        </button>
                    </div>

                    {/* Commits */}
                    <div>
                        <h4 className="text-sm font-medium mb-2">
                            Recent Commits ({commits.length})
                        </h4>
                        {commits.length > 0 ? (
                            <ul className="space-y-2">
                                {commits.slice(0, 5).map((commit) => (
                                    <li
                                        key={commit.hash}
                                        className="text-sm border-l-2 border-muted pl-3 py-1"
                                    >
                                        <div className="font-medium">
                                            {commit.message}
                                        </div>
                                        <div className="text-xs text-muted-foreground">
                                            {commit.quadCount} quads •{" "}
                                            {new Date(
                                                commit.timestamp
                                            ).toLocaleTimeString()}
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-sm text-muted-foreground">
                                No commits yet
                            </p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
