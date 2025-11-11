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
                </div>
            </div>
        </div>
    );
}
