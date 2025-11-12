/**
 * ContextMenu - Right-click context menu for group nodes
 *
 * Provides options to add different types of nodes to a group
 */

import { useEffect } from "react";

export function ContextMenu(
    { position, onClose, onAddNode, onQuickQuad, groupLabel },
) {
    // Close menu on escape key or click outside
    useEffect(() => {
        const handleEscape = (e) => {
            if (e.key === "Escape") onClose();
        };

        const handleClickOutside = () => onClose();

        document.addEventListener("keydown", handleEscape);
        document.addEventListener("click", handleClickOutside);

        return () => {
            document.removeEventListener("keydown", handleEscape);
            document.removeEventListener("click", handleClickOutside);
        };
    }, [onClose]);

    const menuItems = [
        {
            type: "quick-quad",
            label: "Quick Quad (S→A→T→C)",
            icon: "⚡",
            color: "indigo",
            isQuickQuad: true,
        },
        { type: "divider" },
        {
            type: "variable",
            label: "Add Variable",
            icon: "🔮",
            color: "purple",
        },
        { type: "word", label: "Add Word", icon: "📄", color: "blue" },
        { type: "number", label: "Add Number", icon: "🔢", color: "green" },
        { type: "string", label: "Add String", icon: "📝", color: "amber" },
        { type: "wildcard", label: "Add Wildcard", icon: "✱", color: "orange" },
    ];

    return (
        <div
            className="absolute bg-white border border-gray-300 rounded-lg shadow-xl py-1 min-w-[180px] z-[1000]"
            style={{
                left: `${position.x}px`,
                top: `${position.y}px`,
            }}
            onClick={(e) => e.stopPropagation()}
        >
            {/* Header */}
            <div className="px-3 py-2 border-b border-gray-200">
                <div className="text-xs font-semibold text-gray-500 uppercase">
                    {groupLabel}
                </div>
            </div>

            {/* Menu Items */}
            {menuItems.map((item, idx) => {
                // Render divider
                if (item.type === "divider") {
                    return (
                        <div
                            key={`divider-${idx}`}
                            className="h-px bg-gray-200 my-1"
                        />
                    );
                }

                // Render menu item
                return (
                    <button
                        key={item.type}
                        onClick={() => {
                            if (item.isQuickQuad) {
                                onQuickQuad();
                            } else {
                                onAddNode(item.type);
                            }
                            onClose();
                        }}
                        className={`w-full px-3 py-2 text-left text-sm hover:bg-${item.color}-50 flex items-center gap-2 transition-colors ${
                            item.isQuickQuad ? "font-semibold" : ""
                        }`}
                    >
                        <span className="text-base">{item.icon}</span>
                        <span>{item.label}</span>
                    </button>
                );
            })}
        </div>
    );
}
