import { useEffect, useRef, useState } from "react";
import type { Route } from "./+types/builder";
import { bl } from "@bassline/core";
import { installReact } from "@bassline/react";
import "@bassline/taps";  // Auto-installs
import cells from "@bassline/cells";  // Auto-installs
import {
  exportAsPackage,
  extractParameters,
} from "@bassline/core/packageExporter";

bl();
installReact();

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Builder - Bassline" },
    { name: "description", content: "Meta-circular builder demo" },
  ];
}

// Create workspace
const workspace = {
  threshold: cells.gadgets.max.spawn(50),
  input: cells.gadgets.max.spawn(0),
  output: cells.gadgets.last.spawn(0),
};

// Wire
workspace.input.tapOn("changed", (newState) => {
  workspace.output.receive(newState);
});

export default function Builder() {
  const [ready, setReady] = useState(false);

  if (!ready) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <div className="text-xl">Loading Bassline...</div>
      </div>
    );
  }

  return <BuilderUI workspace={workspace} />;
}

function BuilderUI({ workspace }: { workspace: any }) {
  const [threshold, setThreshold] = workspace.threshold.useState();
  const [input, setInput] = workspace.input.useState();
  const [output] = workspace.output.useState();

  const [factories, setFactories] = useState<any[]>([]);
  const [instances, setInstances] = useState<any[]>([]);

  const handleExport = async () => {
    const spec = {
      pkg: "@bassline/compound",
      name: "compound",
      state: {
        imports: {
          cells: "@bassline/cells/numeric",
          unsafe: "@bassline/cells/unsafe",
        },
        gadgets: {
          threshold: workspace.threshold.toSpec(),
          input: workspace.input.toSpec(),
          output: workspace.output.toSpec(),
        },
      },
    };

    const { spec: parameterized, parameters } = extractParameters(spec, {
      include: ["threshold"],
    });

    const pkg = exportAsPackage(parameterized, {
      name: "@demo/workspace",
      gadgetName: "myFilter",
      version: "1.0.0",
      description: "Exported from workspace",
      parameters,
    });

    const json = JSON.stringify(pkg, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "workspace.json";
    a.click();
    URL.revokeObjectURL(url);

    alert("Package exported! Check your downloads.");
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const text = await file.text();
    const pkg = JSON.parse(text);

    const { loadPackage } = await import("@bassline/core/packageLoader");
    loadPackage(pkg);

    setFactories((prev) => [
      ...prev,
      {
        name: pkg.name,
        gadgetName: Object.keys(pkg.gadgets)[0],
        parameters: pkg.gadgets[Object.keys(pkg.gadgets)[0]].parameters || {},
      },
    ]);

    alert(`Package ${pkg.name} loaded!`);
  };

  const handleSpawn = async (factory: any, customParams: any) => {
    const { bl } = await import("@bassline/core");
    const { createPackageResolver } = await import(
      "@bassline/core/packageResolver"
    );

    const resolver = createPackageResolver();
    resolver.import("demo", factory.name);

    const instance = bl().fromSpec(
      {
        type: `demo.${factory.gadgetName}`,
        state: customParams,
      },
      resolver,
    );

    setInstances((prev) => [
      ...prev,
      {
        id: Date.now(),
        factory: factory.name,
        gadget: instance,
        params: customParams,
      },
    ]);
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Bassline Builder Demo</h1>

      <div className="flex gap-4 mb-8">
        <button
          onClick={handleExport}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Export Workspace
        </button>
        <label className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 cursor-pointer">
          Import Package
          <input
            type="file"
            accept=".json"
            onChange={handleImport}
            className="hidden"
          />
        </label>
      </div>

      <div className="mb-8 p-6 border rounded-lg bg-gray-50">
        <h2 className="text-xl font-semibold mb-4">Workspace</h2>
        <div className="space-y-3">
          <div className="flex items-center gap-4">
            <span className="w-24 font-mono">threshold:</span>
            <span className="w-16 text-lg font-bold">{threshold}</span>
            <button
              onClick={() => setThreshold(threshold - 10)}
              className="px-3 py-1 border rounded hover:bg-gray-200"
            >
              -10
            </button>
            <button
              onClick={() => setThreshold(threshold + 10)}
              className="px-3 py-1 border rounded hover:bg-gray-200"
            >
              +10
            </button>
          </div>
          <div className="flex items-center gap-4">
            <span className="w-24 font-mono">input:</span>
            <span className="w-16 text-lg font-bold">{input}</span>
            <button
              onClick={() => setInput(input - 5)}
              className="px-3 py-1 border rounded hover:bg-gray-200"
            >
              -5
            </button>
            <button
              onClick={() => setInput(input + 5)}
              className="px-3 py-1 border rounded hover:bg-gray-200"
            >
              +5
            </button>
          </div>
          <div className="flex items-center gap-4">
            <span className="w-24 font-mono">output:</span>
            <span className="w-16 text-lg font-bold">{output}</span>
            <span className="text-sm text-gray-500">(mirrors input)</span>
          </div>
        </div>
      </div>

      <div className="mb-8 p-6 border rounded-lg bg-blue-50">
        <h2 className="text-xl font-semibold mb-4">Factories</h2>
        {factories.length === 0
          ? (
            <p className="text-gray-500">
              No factories loaded. Import a package to add factories.
            </p>
          )
          : (
            <div className="space-y-3">
              {factories.map((factory, idx) => (
                <div key={idx} className="p-4 bg-white rounded border">
                  <div className="font-semibold mb-2">
                    {factory.name} / {factory.gadgetName}
                  </div>
                  <div className="text-sm text-gray-600 mb-3">
                    Parameters: {JSON.stringify(factory.parameters)}
                  </div>
                  <button
                    onClick={() => {
                      const threshold = prompt(
                        "Enter threshold value:",
                        factory.parameters.threshold || "50",
                      );
                      if (threshold) {
                        handleSpawn(factory, {
                          threshold: parseInt(threshold),
                        });
                      }
                    }}
                    className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                  >
                    Create Instance
                  </button>
                </div>
              ))}
            </div>
          )}
      </div>

      <div className="p-6 border rounded-lg bg-green-50">
        <h2 className="text-xl font-semibold mb-4">Instances</h2>
        {instances.length === 0
          ? (
            <p className="text-gray-500">
              No instances yet. Create instances from factories.
            </p>
          )
          : (
            <div className="space-y-3">
              {instances.map((instance) => (
                <InstanceDisplay key={instance.id} instance={instance} />
              ))}
            </div>
          )}
      </div>
    </div>
  );
}

function InstanceDisplay({ instance }: { instance: any }) {
  const scope = instance.gadget.current().scope;
  const [thresholdValue] = scope.get("threshold").useState();
  const [inputValue, sendInput] = scope.get("input").useState();
  const [outputValue] = scope.get("output").useState();

  return (
    <div className="p-4 bg-white rounded border">
      <div className="font-semibold mb-2">
        {instance.factory} (threshold: {instance.params.threshold})
      </div>
      <div className="space-y-2 text-sm">
        <div className="flex items-center gap-4">
          <span className="w-20 font-mono">threshold:</span>
          <span className="font-bold">{thresholdValue}</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="w-20 font-mono">input:</span>
          <span className="font-bold">{inputValue}</span>
          <button
            onClick={() => sendInput(inputValue + 5)}
            className="px-2 py-1 border rounded text-xs hover:bg-gray-100"
          >
            +5
          </button>
        </div>
        <div className="flex items-center gap-4">
          <span className="w-20 font-mono">output:</span>
          <span className="font-bold">{outputValue}</span>
        </div>
      </div>
    </div>
  );
}
