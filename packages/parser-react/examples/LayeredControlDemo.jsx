/**
 * Demo component showing how to use LayeredControl hooks
 *
 * Usage:
 * ```jsx
 * import { LayeredControl } from "@bassline/parser/control";
 * import { LayeredControlDemo } from "@bassline/parser-react/examples/LayeredControlDemo";
 *
 * const lc = new LayeredControl();
 *
 * function App() {
 *   return (
 *     <LayeredControlProvider value={lc}>
 *       <LayeredControlDemo />
 *     </LayeredControlProvider>
 *   );
 * }
 * ```
 */

import { useState } from "react";
import {
    useLayeredControl,
    useLayers,
    useRouting,
    useStaging,
    useCommits,
    useBranches,
} from "../src/hooks/useLayeredControl.js";

export function LayeredControlDemo() {
    const lc = useLayeredControl();
    const layers = useLayers();
    const routing = useRouting();

    return (
        <div style={{ padding: "20px", fontFamily: "monospace" }}>
            <h1>LayeredControl React Hooks Demo</h1>

            <div style={{ marginBottom: "20px" }}>
                <h2>Layers ({layers.length})</h2>
                <LayerList />
            </div>

            <div style={{ marginBottom: "20px" }}>
                <h2>Routing ({routing.length} connections)</h2>
                <pre>{JSON.stringify(routing, null, 2)}</pre>
            </div>

            <div style={{ marginBottom: "20px" }}>
                <h2>Add Layer</h2>
                <AddLayerForm />
            </div>
        </div>
    );
}

function LayerList() {
    const layers = useLayers();

    if (layers.length === 0) {
        return <p>No layers yet</p>;
    }

    return (
        <div>
            {layers.map((name) => (
                <LayerItem key={name} name={name} />
            ))}
        </div>
    );
}

function LayerItem({ name }) {
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
        <div
            style={{
                border: "1px solid #ccc",
                padding: "10px",
                marginBottom: "10px",
                borderRadius: "4px",
            }}
        >
            <div
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                }}
            >
                <h3>{name}</h3>
                <button onClick={() => setShowDetails(!showDetails)}>
                    {showDetails ? "Hide" : "Show"} Details
                </button>
            </div>

            <div style={{ fontSize: "12px", color: "#666" }}>
                {branches.current && <span>Branch: {branches.current} | </span>}
                {staging.hasChanges ? (
                    <span style={{ color: "orange" }}>
                        {staging.count} staged changes
                    </span>
                ) : (
                    <span style={{ color: "green" }}>Clean</span>
                )}
                {" | "}
                {commits.length} commits
            </div>

            {showDetails && (
                <div style={{ marginTop: "10px" }}>
                    <div style={{ marginBottom: "10px" }}>
                        <h4>Run Command</h4>
                        <input
                            type="text"
                            value={command}
                            onChange={(e) => setCommand(e.target.value)}
                            onKeyDown={(e) =>
                                e.key === "Enter" && handleRunCommand()
                            }
                            placeholder="insert { alice age 30 system }"
                            style={{ width: "400px", marginRight: "5px" }}
                        />
                        <button onClick={handleRunCommand}>Run</button>
                    </div>

                    {staging.hasChanges && (
                        <div style={{ marginBottom: "10px" }}>
                            <button onClick={handleCommit}>
                                Commit {staging.count} changes
                            </button>
                        </div>
                    )}

                    <div style={{ marginBottom: "10px" }}>
                        <h4>Branches ({branches.branches.length})</h4>
                        {branches.branches.length > 0 ? (
                            <div>
                                {branches.branches.map((branch) => (
                                    <button
                                        key={branch}
                                        onClick={() =>
                                            lc.switchBranch(name, branch)
                                        }
                                        style={{
                                            marginRight: "5px",
                                            fontWeight:
                                                branch === branches.current
                                                    ? "bold"
                                                    : "normal",
                                        }}
                                    >
                                        {branch}
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <p>No branches yet</p>
                        )}
                        <button
                            onClick={handleCreateBranch}
                            style={{ marginTop: "5px" }}
                        >
                            Create Branch
                        </button>
                    </div>

                    <div>
                        <h4>Recent Commits ({commits.length})</h4>
                        {commits.length > 0 ? (
                            <ul style={{ fontSize: "12px" }}>
                                {commits.slice(0, 5).map((commit) => (
                                    <li key={commit.hash}>
                                        <strong>{commit.message}</strong> (
                                        {commit.quadCount} quads) -{" "}
                                        {new Date(
                                            commit.timestamp
                                        ).toLocaleTimeString()}
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p>No commits yet</p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

function AddLayerForm() {
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
        <div>
            <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                placeholder="Layer name"
                style={{ marginRight: "5px" }}
            />
            <button onClick={handleAdd}>Add Layer</button>
        </div>
    );
}
