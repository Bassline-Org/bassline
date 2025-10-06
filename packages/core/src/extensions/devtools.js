const { gadgetProto, StateSymbol } = bl();

export function installDevtools() {
    // Extend the prototype with debugging info
    Object.assign(gadgetProto, {
        // Get debug info without exposing internals
        __inspect() {
            return {
                state: this[StateSymbol],
                step: this.step?.name || "anonymous",
                prototype: Object.getPrototypeOf(this),
            };
        },

        // Get a nice string representation
        toString() {
            const state = JSON.stringify(this[StateSymbol]);
            return `Gadget(${
                state.length > 20 ? state.slice(0, 20) + "..." : state
            })`;
        },
    });

    // Create the custom formatter for Chrome DevTools
    const gadgetFormatter = {
        // Detect if this is a gadget
        header(obj) {
            // Check if it's a gadget by checking prototype chain
            if (!obj || typeof obj !== "object") return null;
            if (!Object.prototype.isPrototypeOf.call(gadgetProto, obj)) {
                return null;
            }

            // Get state and metadata
            const state = obj[StateSymbol];
            const stepName = obj.step?.name || "anonymous";

            // Format the state for display
            let stateDisplay = "";
            try {
                if (state === null || state === undefined) {
                    stateDisplay = String(state);
                } else if (typeof state === "object") {
                    if (state instanceof Set) {
                        stateDisplay = `Set(${state.size})`;
                    } else if (state instanceof Map) {
                        stateDisplay = `Map(${state.size})`;
                    } else if (Array.isArray(state)) {
                        stateDisplay = `[${state.length} items]`;
                    } else {
                        const keys = Object.keys(state);
                        stateDisplay = keys.length > 0
                            ? `{${keys.slice(0, 3).join(", ")}${
                                keys.length > 3 ? "..." : ""
                            }}`
                            : "{}";
                    }
                } else {
                    stateDisplay = String(state);
                    if (stateDisplay.length > 30) {
                        stateDisplay = stateDisplay.slice(0, 30) + "…";
                    }
                }
            } catch (e) {
                stateDisplay = "???";
            }

            // Return JSONML format for DevTools
            return [
                "div",
                {
                    style:
                        "display: flex; align-items: center; gap: 6px; font-family: monospace;",
                },

                // Icon based on step type
                [
                    "span",
                    { style: "font-size: 14px;" },
                    obj.metadata?.get("ui/icon")?.current?.() || "◆",
                ],

                // Type badge
                ["span", {
                    style: `
            background: linear-gradient(90deg, #4F46E5, #7C3AED);
            color: white;
            padding: 2px 6px;
            border-radius: 4px;
            font-size: 11px;
            font-weight: bold;
            text-transform: uppercase;
          `,
                }, stepName],

                // Arrow
                ["span", { style: "color: #6B7280;" }, "→"],

                // State display
                ["span", {
                    style: `
            color: #059669;
            font-weight: bold;
            font-family: 'SF Mono', Monaco, monospace;
          `,
                }, stateDisplay],
            ];
        },

        // Can we expand it?
        hasBody(obj) {
            if (!Object.prototype.isPrototypeOf.call(gadgetProto, obj)) {
                return false;
            }
            const state = obj[StateSymbol];
            return state !== null && state !== undefined;
        },

        // Expanded view
        body(obj) {
            const state = obj[StateSymbol];
            const stepName = obj.step?.name || "anonymous";
            const stepCode = obj.step?.toString() || "unknown";

            const sections = [
                "div",
                {
                    style:
                        "padding-left: 20px; font-family: monospace; line-height: 1.6;",
                },
            ];

            // Current State section
            sections.push([
                "div",
                { style: "margin: 8px 0;" },
                [
                    "span",
                    { style: "color: #6B7280; font-weight: bold;" },
                    "State: ",
                ],
                ["object", { object: state }],
            ]);

            // Step function info
            sections.push([
                "div",
                { style: "margin: 8px 0;" },
                [
                    "span",
                    { style: "color: #6B7280; font-weight: bold;" },
                    "Step: ",
                ],
                ["span", { style: "color: #8B5CF6;" }, stepName],
            ]);

            // Step implementation (first 100 chars)
            if (stepCode.length < 200) {
                sections.push([
                    "div",
                    { style: "margin: 8px 0;" },
                    [
                        "span",
                        { style: "color: #6B7280; font-weight: bold;" },
                        "Implementation: ",
                    ],
                    stepCode,
                ]);
            }

            // Actions to take
            sections.push([
                "div",
                {
                    style:
                        "margin-top: 12px; padding-top: 8px; border-top: 1px solid #E5E7EB;",
                },
                ["div", {
                    style:
                        "color: #6B7280; font-size: 11px; margin-bottom: 4px;",
                }, "Actions:"],
                [
                    "div",
                    { style: "color: #3B82F6; font-size: 11px;" },
                    "• Right-click → Store as global variable",
                ],
                [
                    "div",
                    { style: "color: #3B82F6; font-size: 11px;" },
                    "• Use temp1.receive(value) to send values",
                ],
                [
                    "div",
                    { style: "color: #3B82F6; font-size: 11px;" },
                    "• Use temp1.__inspect() for debug info",
                ],
            ]);
            return sections;
        },
    };

    // Install the formatter
    globalThis.devtoolsFormatters = globalThis.devtoolsFormatters || [];
    globalThis.devtoolsFormatters.push(gadgetFormatter);

    console.log(
        "%c🎨 Gadget Formatter Installed!",
        "background: linear-gradient(90deg, #4F46E5, #7C3AED); color: white; padding: 4px 8px; border-radius: 4px; font-weight: bold;",
    );
    console.log(
        '%cEnable "Custom Formatters" in DevTools Settings → Preferences → Console',
        "color: #6B7280; font-style: italic;",
    );
}

// Export for manual installation
export default installDevtools;
