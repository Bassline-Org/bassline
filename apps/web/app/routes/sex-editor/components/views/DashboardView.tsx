import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import { BigNumberView } from "./BigNumberView";
import { LineChartView } from "./LineChartView";
import { TableView } from "./TableView";
import { GaugeView } from "./GaugeView";

// Map of view names to components
const VIEW_COMPONENTS: Record<string, React.ComponentType<NodeProps>> = {
    bigNumber: BigNumberView,
    lineChart: LineChartView,
    table: TableView,
    gauge: GaugeView,
};

export const DashboardView = memo(({ data }: NodeProps) => {
    const { gadget } = data; // This is a sex gadget
    const workspace = gadget.useCurrent(); // All spawned gadgets

    // Filter to only gadgets with custom views (not default or wire gadgets)
    const viewGadgets = Object.entries(workspace)
        .filter(([_, g]) => {
            const isWire = g.pkg === "@bassline/relations" && g.name === "scopedWire";
            if (isWire) return false;

            const view = g.getView ? g.getView() : "default";
            return view !== "default";
        })
        .map(([name, g]) => ({
            name,
            gadget: g,
            view: g.getView ? g.getView() : "default",
        }));

    return (
        <div className="w-full h-full bg-gray-50 overflow-auto">
            {viewGadgets.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-6 auto-rows-min">
                    {viewGadgets.map(({ name, gadget, view }) => {
                        const ViewComp = VIEW_COMPONENTS[view];
                        return ViewComp ? (
                            <div
                                key={name}
                                className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow"
                            >
                                <ViewComp
                                    data={{ name, gadget }}
                                    selected={false}
                                />
                            </div>
                        ) : null;
                    })}
                </div>
            ) : (
                <div className="flex items-center justify-center h-full">
                    <div className="text-center text-gray-400 max-w-md p-8">
                        <div className="text-6xl mb-4">📊</div>
                        <h3 className="text-xl font-semibold mb-2 text-gray-600">
                            No Views in Dashboard
                        </h3>
                        <p className="text-sm">
                            Add gadgets to your workspace and set their views to populate this dashboard.
                            Switch back to Canvas view to edit your workspace.
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
});

DashboardView.displayName = "DashboardView";
