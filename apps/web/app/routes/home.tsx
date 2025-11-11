import type { Route } from "./+types/home";
import { Link } from "react-router";
import { Button } from "~/components/ui/button";

export function meta({}: Route.MetaArgs) {
    return [
        { title: "Bassline" },
        { name: "description", content: "Propagation networks" },
    ];
}

export default function Home() {
    return (
        <div className="min-h-screen bg-slate-50">
            <div className="container mx-auto py-12 px-4">
                <h1 className="text-4xl font-bold mb-8">Bassline</h1>
                <p className="text-lg text-slate-600 mb-12">
                    A hyper-minimal propagation network model
                </p>

                {/* Featured: Full Workspace */}
                <Link to="/workspace-full" className="block mb-8">
                    <div className="border-2 border-amber-300 rounded-xl p-8 hover:border-amber-400 hover:shadow-2xl transition-all bg-gradient-to-br from-amber-50 to-orange-50">
                        <div className="flex items-center gap-3 mb-3">
                            <span className="text-4xl">✨</span>
                            <h2 className="text-3xl font-bold text-amber-900">
                                Full Workspace
                            </h2>
                            <span className="px-3 py-1 bg-amber-200 text-amber-900 text-xs font-bold rounded-full">
                                NEW
                            </span>
                        </div>
                        <p className="text-lg text-slate-700 mb-4">
                            Complete workspace with all panels in a dynamic,
                            customizable layout - drag, resize, and arrange panels
                            to create your perfect development environment
                        </p>
                        <div className="flex gap-4 items-center">
                            <Button size="lg" variant="default">
                                Open Full Workspace
                            </Button>
                            <span className="text-sm text-slate-600">
                                Includes: Layer List • REPL • Plugboard • Version Control
                            </span>
                        </div>
                    </div>
                </Link>

                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {/* Sex Editor */}
                    <Link to="/sex-editor" className="block">
                        <div className="border border-violet-200 rounded-lg p-6 hover:border-violet-300 hover:shadow-lg transition-all bg-violet-50">
                            <h2 className="text-xl font-semibold mb-2">
                                ⚡ Sex Editor
                            </h2>
                            <p className="text-slate-600 mb-4">
                                Sequential execution shell for gadget networks -
                                build, inspect, and orchestrate
                            </p>
                            <Button variant="default">Open Sex Editor</Button>
                        </div>
                    </Link>

                    {/* Bassline REPL */}
                    <Link to="/bassline-repl" className="block">
                        <div className="border border-blue-200 rounded-lg p-6 hover:border-blue-300 hover:shadow-lg transition-all bg-blue-50">
                            <h2 className="text-xl font-semibold mb-2">
                                💬 Bassline REPL
                            </h2>
                            <p className="text-slate-600 mb-4">
                                Interactive Bassline language environment -
                                evaluate code, explore the system
                            </p>
                            <Button variant="default">Open REPL</Button>
                        </div>
                    </Link>

                    {/* Graph Visualization */}
                    <Link to="/graph-viz" className="block">
                        <div className="border border-green-200 rounded-lg p-6 hover:border-green-300 hover:shadow-lg transition-all bg-green-50">
                            <h2 className="text-xl font-semibold mb-2">
                                🕸️ Graph Visualization
                            </h2>
                            <p className="text-slate-600 mb-4">
                                Real-time graph visualization with React Flow -
                                watch quads update live
                            </p>
                            <Button variant="default">Open Graph</Button>
                        </div>
                    </Link>

                    {/* Components Demo */}
                    <Link to="/components-demo" className="block">
                        <div className="border border-purple-200 rounded-lg p-6 hover:border-purple-300 hover:shadow-lg transition-all bg-purple-50">
                            <h2 className="text-xl font-semibold mb-2">
                                🧩 Components Demo
                            </h2>
                            <p className="text-slate-600 mb-4">
                                Graph-native React components -
                                EntityCard, QuadTable, PatternEditor, Inspector
                            </p>
                            <Button variant="default">Open Demo</Button>
                        </div>
                    </Link>

                    {/* LayeredControl Hooks Demo */}
                    <Link to="/layered-control-demo" className="block">
                        <div className="border border-orange-200 rounded-lg p-6 hover:border-orange-300 hover:shadow-lg transition-all bg-orange-50">
                            <h2 className="text-xl font-semibold mb-2">
                                🎛️ LayeredControl Hooks
                            </h2>
                            <p className="text-slate-600 mb-4">
                                Reactive LayeredControl with Git-style version control -
                                layers, commits, branches, staging
                            </p>
                            <Button variant="default">Open Demo</Button>
                        </div>
                    </Link>

                    {/* Project Management Demo */}
                    <Link to="/project-demo" className="block">
                        <div className="border border-teal-200 rounded-lg p-6 hover:border-teal-300 hover:shadow-lg transition-all bg-teal-50">
                            <h2 className="text-xl font-semibold mb-2">
                                💾 Project Management
                            </h2>
                            <p className="text-slate-600 mb-4">
                                Unified project files with LayeredControl + UI state -
                                save, load, export, import complete projects
                            </p>
                            <Button variant="default">Open Demo</Button>
                        </div>
                    </Link>

                    {/* Layers Workspace */}
                    <Link to="/workspace-layers" className="block">
                        <div className="border border-indigo-200 rounded-lg p-6 hover:border-indigo-300 hover:shadow-lg transition-all bg-indigo-50">
                            <h2 className="text-xl font-semibold mb-2">
                                🎛️ Layers Workspace
                            </h2>
                            <p className="text-slate-600 mb-4">
                                Interactive workspace for managing layers -
                                unified view with shared context and multiple panels
                            </p>
                            <Button variant="default">Open Workspace</Button>
                        </div>
                    </Link>

                    {/* Plugboard Workspace */}
                    <Link to="/workspace-plugboard" className="block">
                        <div className="border border-pink-200 rounded-lg p-6 hover:border-pink-300 hover:shadow-lg transition-all bg-pink-50">
                            <h2 className="text-xl font-semibold mb-2">
                                🔌 Plugboard Workspace
                            </h2>
                            <p className="text-slate-600 mb-4">
                                Visual routing diagram with React Flow -
                                drag-and-drop connections between layers
                            </p>
                            <Button variant="default">Open Plugboard</Button>
                        </div>
                    </Link>

                    {/* Staging & Commits Workspace */}
                    <Link to="/workspace-staging" className="block">
                        <div className="border border-emerald-200 rounded-lg p-6 hover:border-emerald-300 hover:shadow-lg transition-all bg-emerald-50">
                            <h2 className="text-xl font-semibold mb-2">
                                📦 Staging & Commits
                            </h2>
                            <p className="text-slate-600 mb-4">
                                Git-style version control workspace -
                                staging, commits, history, and branch management
                            </p>
                            <Button variant="default">Open Staging</Button>
                        </div>
                    </Link>
                </div>
            </div>
        </div>
    );
}
