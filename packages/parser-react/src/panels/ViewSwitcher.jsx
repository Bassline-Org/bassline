/**
 * ViewSwitcher - Component for switching between saved layout views
 *
 * Allows users to:
 * - Switch between existing views
 * - Save current layout as a new view
 * - Delete views (except default)
 * - See which view is currently active
 */

import { useState, useRef, useEffect } from "react";

/**
 * ViewSwitcher component
 *
 * @param {Object} props
 * @param {string} props.currentViewName - Name of currently active view
 * @param {string[]} props.viewNames - Array of all view names
 * @param {Function} props.onLoadView - Callback when view is selected (receives viewName)
 * @param {Function} props.onSaveView - Callback to save current layout as new view (receives viewName)
 * @param {Function} props.onDeleteView - Callback to delete a view (receives viewName)
 * @returns {JSX.Element}
 */
export function ViewSwitcher({
    currentViewName,
    viewNames,
    onLoadView,
    onSaveView,
    onDeleteView,
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [newViewName, setNewViewName] = useState("");
    const [showSaveInput, setShowSaveInput] = useState(false);
    const menuRef = useRef(null);

    // Close menu when clicking outside
    useEffect(() => {
        function handleClickOutside(event) {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setIsOpen(false);
                setShowSaveInput(false);
                setNewViewName("");
            }
        }

        if (isOpen) {
            document.addEventListener("mousedown", handleClickOutside);
            return () => document.removeEventListener("mousedown", handleClickOutside);
        }
    }, [isOpen]);

    const handleLoadView = (viewName) => {
        onLoadView(viewName);
        setIsOpen(false);
    };

    const handleSaveView = () => {
        if (newViewName.trim()) {
            onSaveView(newViewName.trim());
            setNewViewName("");
            setShowSaveInput(false);
        }
    };

    const handleDeleteView = (viewName, event) => {
        event.stopPropagation();
        if (confirm(`Delete view "${viewName}"? This cannot be undone.`)) {
            onDeleteView(viewName);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === "Enter") {
            handleSaveView();
        } else if (e.key === "Escape") {
            setShowSaveInput(false);
            setNewViewName("");
        }
    };

    return (
        <div className="relative" ref={menuRef}>
            {/* View Switcher Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50 transition-colors"
                title="Switch layout view"
            >
                <span>📐</span>
                <span>View: {currentViewName}</span>
                <span className="text-slate-400">▼</span>
            </button>

            {/* Dropdown Menu */}
            {isOpen && (
                <div className="absolute top-full right-0 mt-2 w-64 bg-white rounded-lg shadow-xl border border-slate-200 z-[200] dropdown-menu overflow-hidden">
                    {/* Header */}
                    <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
                        <h3 className="font-semibold text-slate-900">Layout Views</h3>
                        <p className="text-xs text-slate-600 mt-1">
                            {viewNames.length} view{viewNames.length !== 1 ? "s" : ""} available
                        </p>
                    </div>

                    {/* View List */}
                    <div className="max-h-64 overflow-y-auto">
                        {viewNames.map((viewName) => {
                            const isActive = viewName === currentViewName;
                            const isDeletable = viewName !== "default";

                            return (
                                <div
                                    key={viewName}
                                    className={`flex items-center justify-between px-4 py-2.5 hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-b-0 ${
                                        isActive ? "bg-blue-50" : ""
                                    }`}
                                >
                                    <button
                                        onClick={() => handleLoadView(viewName)}
                                        className={`flex-1 text-left font-medium ${
                                            isActive ? "text-blue-700" : "text-slate-700"
                                        }`}
                                    >
                                        {viewName}
                                        {isActive && (
                                            <span className="ml-2 text-xs px-2 py-0.5 bg-blue-200 text-blue-800 rounded-full">
                                                Active
                                            </span>
                                        )}
                                    </button>

                                    {isDeletable && (
                                        <button
                                            onClick={(e) => handleDeleteView(viewName, e)}
                                            className="ml-2 text-slate-400 hover:text-red-600 transition-colors"
                                            title="Delete view"
                                        >
                                            ✕
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {/* Save New View Section */}
                    <div className="border-t border-slate-200 p-3">
                        {!showSaveInput ? (
                            <button
                                onClick={() => setShowSaveInput(true)}
                                className="w-full px-3 py-2 text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded transition-colors"
                            >
                                💾 Save Current Layout As...
                            </button>
                        ) : (
                            <div className="space-y-2">
                                <input
                                    type="text"
                                    placeholder="View name..."
                                    value={newViewName}
                                    onChange={(e) => setNewViewName(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    autoFocus
                                />
                                <div className="flex gap-2">
                                    <button
                                        onClick={handleSaveView}
                                        disabled={!newViewName.trim()}
                                        className="flex-1 px-3 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        Save
                                    </button>
                                    <button
                                        onClick={() => {
                                            setShowSaveInput(false);
                                            setNewViewName("");
                                        }}
                                        className="px-3 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded transition-colors"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
