import { useRef } from "react";
import type { Route } from "./+types/project-demo";
import { LayeredControlProvider } from "@bassline/parser-react/hooks";
import { LayerListPanel } from "@bassline/parser-react/components";
import { useProject } from "@bassline/parser-react";
import { Button } from "~/components/ui/button";

export function meta({}: Route.MetaArgs) {
    return [
        { title: "Project Management Demo" },
        {
            name: "description",
            content: "Demo of unified project files with LayeredControl + UI state",
        },
    ];
}

export default function ProjectDemo() {
    const {
        lc,
        projectName,
        uiConfig,
        isDirty,
        exportProject,
        importProject,
        newProject,
        listProjects,
        loadProject,
        deleteProject,
    } = useProject("demo-project");

    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            importProject(file);
        }
    };

    const handleNewProject = () => {
        const name = prompt("Project name:");
        if (name) {
            newProject(name);
        }
    };

    const recentProjects = listProjects();

    return (
        <LayeredControlProvider value={lc}>
            <div className="min-h-screen bg-background p-8">
                <div className="max-w-7xl mx-auto space-y-6">
                    {/* Header */}
                    <div>
                        <h1 className="text-4xl font-bold mb-2">
                            Project Management Demo
                        </h1>
                        <p className="text-muted-foreground">
                            Unified project files with LayeredControl state + UI
                            configuration
                        </p>
                    </div>

                    {/* Project Controls */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Current Project Info */}
                        <div className="border rounded-lg p-6 bg-card">
                            <h2 className="text-2xl font-semibold mb-4">
                                Current Project
                            </h2>
                            <div className="space-y-3">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">
                                        Name:
                                    </span>
                                    <span className="font-mono font-semibold">
                                        {projectName}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">
                                        Status:
                                    </span>
                                    <span
                                        className={`font-medium ${
                                            isDirty
                                                ? "text-orange-500"
                                                : "text-green-500"
                                        }`}
                                    >
                                        {isDirty ? "Modified" : "Saved"}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">
                                        Panels:
                                    </span>
                                    <span className="font-mono">
                                        {uiConfig.panels.length}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Project Actions */}
                        <div className="border rounded-lg p-6 bg-card">
                            <h2 className="text-2xl font-semibold mb-4">
                                Project Actions
                            </h2>
                            <div className="space-y-3">
                                <Button
                                    onClick={handleNewProject}
                                    className="w-full"
                                    variant="default"
                                >
                                    New Project
                                </Button>

                                <Button
                                    onClick={exportProject}
                                    className="w-full"
                                    variant="outline"
                                >
                                    Export Project (.bassline.json)
                                </Button>

                                <div>
                                    <Button
                                        onClick={() =>
                                            fileInputRef.current?.click()
                                        }
                                        className="w-full"
                                        variant="outline"
                                    >
                                        Import Project
                                    </Button>
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept=".bassline.json,.json"
                                        style={{ display: "none" }}
                                        onChange={handleImport}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Recent Projects */}
                    {recentProjects.length > 0 && (
                        <div className="border rounded-lg p-6 bg-card">
                            <h2 className="text-2xl font-semibold mb-4">
                                Recent Projects
                            </h2>
                            <div className="space-y-2">
                                {recentProjects.map((proj) => (
                                    <div
                                        key={proj.name}
                                        className="flex items-center justify-between p-3 border rounded-md hover:bg-accent/50 transition-colors"
                                    >
                                        <div className="flex-1 min-w-0">
                                            <div className="font-medium truncate">
                                                {proj.name}
                                            </div>
                                            <div className="text-xs text-muted-foreground">
                                                {new Date(
                                                    proj.timestamp
                                                ).toLocaleString()}
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <Button
                                                onClick={() =>
                                                    loadProject(proj.name)
                                                }
                                                variant="outline"
                                                size="sm"
                                                disabled={
                                                    proj.name === projectName
                                                }
                                            >
                                                {proj.name === projectName
                                                    ? "Current"
                                                    : "Load"}
                                            </Button>
                                            <Button
                                                onClick={() =>
                                                    deleteProject(proj.name)
                                                }
                                                variant="destructive"
                                                size="sm"
                                            >
                                                Delete
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Layer Management Panel */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="h-[500px]">
                            <LayerListPanel />
                        </div>

                        {/* Instructions */}
                        <div className="border rounded-lg p-6 bg-card">
                            <h2 className="text-2xl font-semibold mb-4">
                                How It Works
                            </h2>
                            <div className="space-y-4 text-sm">
                                <div>
                                    <h3 className="font-semibold mb-2">
                                        1. Add Layers
                                    </h3>
                                    <p className="text-muted-foreground">
                                        Use the LayerListPanel to add layers.
                                        Each layer has its own graph, staging
                                        area, and commit history.
                                    </p>
                                </div>

                                <div>
                                    <h3 className="font-semibold mb-2">
                                        2. Auto-Save
                                    </h3>
                                    <p className="text-muted-foreground">
                                        Changes are automatically saved to
                                        localStorage after 1 second of
                                        inactivity. The "Status" shows if there
                                        are unsaved changes.
                                    </p>
                                </div>

                                <div>
                                    <h3 className="font-semibold mb-2">
                                        3. Export Project
                                    </h3>
                                    <p className="text-muted-foreground">
                                        Download a <code>.bassline.json</code>{" "}
                                        file containing the complete project
                                        state: LayeredControl data + UI
                                        configuration.
                                    </p>
                                </div>

                                <div>
                                    <h3 className="font-semibold mb-2">
                                        4. Import Project
                                    </h3>
                                    <p className="text-muted-foreground">
                                        Upload a <code>.bassline.json</code>{" "}
                                        file to restore a complete project. The
                                        entire state is restored including
                                        layers, commits, branches, and UI
                                        layout.
                                    </p>
                                </div>

                                <div>
                                    <h3 className="font-semibold mb-2">
                                        5. Multiple Projects
                                    </h3>
                                    <p className="text-muted-foreground">
                                        Create multiple projects and switch
                                        between them using the "Recent Projects"
                                        list. Each project is stored separately
                                        in localStorage.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </LayeredControlProvider>
    );
}
