/**
 * AddPanelMenu - Dropdown menu for adding panels to layout
 *
 * Displays all available panels from the registry with icons and descriptions.
 * Clicking a panel adds it to the layout.
 */

import { useState, useRef, useEffect } from "react";
import { getAllPanels } from "./PanelRegistry.js";

/**
 * AddPanelMenu component
 *
 * @param {Object} props
 * @param {Function} props.onAddPanel - Callback when panel is added (receives panelType)
 * @param {string[]} [props.currentPanels] - Currently active panel types (to show which are already added)
 * @returns {JSX.Element}
 */
export function AddPanelMenu({ onAddPanel, currentPanels = [] }) {
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef(null);

    const allPanels = getAllPanels();

    // Close menu when clicking outside
    useEffect(() => {
        function handleClickOutside(event) {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        }

        if (isOpen) {
            document.addEventListener("mousedown", handleClickOutside);
            return () => document.removeEventListener("mousedown", handleClickOutside);
        }
    }, [isOpen]);

    const handleAddPanel = (panelType) => {
        onAddPanel(panelType);
        setIsOpen(false);
    };

    return (
        <div className="relative" ref={menuRef}>
            {/* Add Panel Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-700 transition-colors"
            >
                <span>➕</span>
                <span>Add Panel</span>
            </button>

            {/* Dropdown Menu */}
            {isOpen && (
                <div className="absolute top-full right-0 mt-2 w-80 bg-white rounded-lg shadow-xl border border-slate-200 z-[200] dropdown-menu overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
                        <h3 className="font-semibold text-slate-900">Add Panel</h3>
                        <p className="text-xs text-slate-600 mt-1">
                            Choose a panel to add to your workspace
                        </p>
                    </div>

                    <div className="max-h-96 overflow-y-auto">
                        {allPanels.map((panel) => {
                            const isActive = currentPanels.includes(panel.id);

                            return (
                                <button
                                    key={panel.id}
                                    onClick={() => handleAddPanel(panel.id)}
                                    disabled={isActive}
                                    className={`w-full px-4 py-3 text-left hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-b-0 ${
                                        isActive ? "opacity-50 cursor-not-allowed" : ""
                                    }`}
                                >
                                    <div className="flex items-start gap-3">
                                        {/* Panel Icon */}
                                        <span className="text-2xl flex-shrink-0">
                                            {panel.icon}
                                        </span>

                                        {/* Panel Info */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <h4 className="font-medium text-slate-900">
                                                    {panel.name}
                                                </h4>
                                                {isActive && (
                                                    <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full">
                                                        Active
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-sm text-slate-600 mt-0.5">
                                                {panel.description}
                                            </p>

                                            {/* Tags */}
                                            {panel.tags && panel.tags.length > 0 && (
                                                <div className="flex gap-1 mt-2">
                                                    {panel.tags.map((tag) => (
                                                        <span
                                                            key={tag}
                                                            className="text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded"
                                                        >
                                                            {tag}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
