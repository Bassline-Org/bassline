import { useEffect, useState, useRef, useMemo } from "react";

interface CommandPaletteProps {
    isOpen: boolean;
    onClose: () => void;
    onSpawn: (pkg: string, name: string) => void;
    packages: any;
}

interface GadgetOption {
    pkg: string;
    name: string;
    icon: string;
}

const GADGET_ICONS: Record<string, string> = {
    "@bassline/cells/numeric": "🔢",
    "@bassline/cells/set": "📊",
    "@bassline/cells/tables": "📝",
    "@bassline/cells/unsafe": "⚠️",
    "@bassline/cells/versioned": "📌",
    "@bassline/systems": "🎯",
    "@bassline/relations": "🔗",
    "@bassline/functions": "🔧",
};

function getIcon(pkg: string): string {
    return GADGET_ICONS[pkg] || "📦";
}

export function CommandPalette({ isOpen, onClose, onSpawn, packages }: CommandPaletteProps) {
    const [query, setQuery] = useState("");
    const [selectedIndex, setSelectedIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);

    // Extract all gadgets from packages (flat scope structure)
    const allGadgets = useMemo(() => {
        const gadgets: GadgetOption[] = [];
        if (packages) {
            Object.entries(packages).forEach(([key, proto]) => {
                // Skip scope prototype methods
                if (key.startsWith('__') || typeof proto === 'function') {
                    return;
                }

                // Parse key format: "@bassline/cells/max" → pkg: "@bassline/cells", name: "max"
                const parts = key.split('/');
                const name = parts.pop();
                const pkg = parts.join('/');

                if (name && pkg) {
                    gadgets.push({
                        pkg,
                        name,
                        icon: getIcon(pkg),
                    });
                }
            });
        }
        return gadgets;
    }, [packages]);

    // Fuzzy filter gadgets based on query
    const filteredGadgets = allGadgets.filter((gadget) => {
        if (!query.trim()) return true;
        const searchStr = `${gadget.pkg} ${gadget.name}`.toLowerCase();
        const queryLower = query.toLowerCase();
        return searchStr.includes(queryLower);
    });

    // Limit to 10 results
    const displayedGadgets = filteredGadgets.slice(0, 10);

    // Auto-focus input when opened
    useEffect(() => {
        if (isOpen) {
            inputRef.current?.focus();
            setQuery("");
            setSelectedIndex(0);
        }
    }, [isOpen]);

    // Handle keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!isOpen) return;

            if (e.key === "Escape") {
                e.preventDefault();
                onClose();
            } else if (e.key === "ArrowDown") {
                e.preventDefault();
                setSelectedIndex((prev) => Math.min(prev + 1, displayedGadgets.length - 1));
            } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setSelectedIndex((prev) => Math.max(prev - 1, 0));
            } else if (e.key === "Enter") {
                e.preventDefault();
                const selected = displayedGadgets[selectedIndex];
                if (selected) {
                    onSpawn(selected.pkg, selected.name);
                    onClose();
                }
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, displayedGadgets, selectedIndex, onClose, onSpawn]);

    // Reset selection when query changes
    useEffect(() => {
        setSelectedIndex(0);
    }, [query]);

    if (!isOpen) return null;

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black bg-opacity-30 backdrop-blur-sm z-40"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="fixed inset-0 flex items-start justify-center pt-[20vh] z-50 pointer-events-none">
                <div className="bg-white rounded-lg shadow-2xl w-full max-w-2xl pointer-events-auto">
                    {/* Search Input */}
                    <div className="border-b p-4">
                        <input
                            ref={inputRef}
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Search gadgets... (type to filter)"
                            className="w-full px-4 py-2 text-lg border-none outline-none focus:ring-0"
                        />
                    </div>

                    {/* Results List */}
                    <div className="max-h-[400px] overflow-y-auto">
                        {displayedGadgets.length === 0 ? (
                            <div className="p-8 text-center text-gray-500">
                                No gadgets found matching "{query}"
                            </div>
                        ) : (
                            <div className="py-2">
                                {displayedGadgets.map((gadget, index) => (
                                    <button
                                        key={`${gadget.pkg}-${gadget.name}`}
                                        onClick={() => {
                                            onSpawn(gadget.pkg, gadget.name);
                                            onClose();
                                        }}
                                        className={`w-full text-left px-4 py-3 flex items-center gap-3 transition-colors ${
                                            index === selectedIndex
                                                ? "bg-blue-50 border-l-4 border-blue-500"
                                                : "hover:bg-gray-50"
                                        }`}
                                    >
                                        <span className="text-2xl">{gadget.icon}</span>
                                        <div className="flex-1">
                                            <div className="font-semibold text-sm">
                                                {gadget.name}
                                            </div>
                                            <div className="font-mono text-xs text-gray-500">
                                                {gadget.pkg}
                                            </div>
                                        </div>
                                        {index === selectedIndex && (
                                            <div className="text-xs text-blue-600 font-mono">
                                                ↵ Enter
                                            </div>
                                        )}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="border-t p-2 bg-gray-50 text-xs text-gray-500 flex gap-4 justify-center">
                        <span>
                            <kbd className="px-1.5 py-0.5 bg-white border rounded">↑↓</kbd> Navigate
                        </span>
                        <span>
                            <kbd className="px-1.5 py-0.5 bg-white border rounded">↵</kbd> Select
                        </span>
                        <span>
                            <kbd className="px-1.5 py-0.5 bg-white border rounded">Esc</kbd> Close
                        </span>
                    </div>
                </div>
            </div>
        </>
    );
}
