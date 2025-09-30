import { useState, useCallback } from "react";
import type { Route } from "./+types/bassline-playground";
import type { Node, Edge, Connection } from "reactflow";
import {
  quick,
  maxProto,
  minProto,
  lastProto,
  withTaps,
  factoryBassline,
  type FactoryBasslineSpec,
  type Gadget,
} from "port-graphs";
import {
  useGadget,
  useGadgetEffect,
} from "port-graphs-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Label } from "~/components/ui/label";
import ReactFlow, {
  Controls,
  Background,
  MiniMap,
  useNodesState,
  useEdgesState,
  MarkerType,
} from "reactflow";
import "reactflow/dist/style.css";

export function meta({ }: Route.MetaArgs) {
  return [
    { title: "Bassline Playground" },
    { name: "description", content: "Interactive bassline network builder" },
  ];
}

// Type registry that returns pre-wrapped (tappable) gadgets using NEW proto system
const typeRegistry = {
  max: (initialValue: number) => withTaps(quick(maxProto, initialValue)),
  min: (initialValue: number) => withTaps(quick(minProto, initialValue)),
  last: <T,>(initialValue: T) => withTaps(quick(lastProto<T>(), initialValue)),
};

// Define empty nodeTypes and edgeTypes outside component to avoid React Flow warnings
const nodeTypes = {};
const edgeTypes = {};

function BasslinePlaygroundContent({ bassline }: { bassline: Gadget<FactoryBasslineSpec> & { tap: any } }) {
  // Use the bassline gadget - cast for proper type inference
  const [state, send] = useGadget(bassline as Gadget<FactoryBasslineSpec>);

  // Track UI state
  const [selectedType, setSelectedType] = useState("max");
  const [instanceName, setInstanceName] = useState("");
  const [fromInstance, setFromInstance] = useState("");
  const [toInstance, setToInstance] = useState("");
  const [selectedInstance, setSelectedInstance] = useState<string | null>(null);
  const [testValue, setTestValue] = useState("");
  const [flowHistory, setFlowHistory] = useState<Array<{ from: string; to: string; value: any; timestamp: number }>>([]);

  // React Flow state
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // Use gadget effect to track changes
  useGadgetEffect(bassline, (effect) => {
    updateFlowGraph(state);

    // Track data flow for visualization
    if ('connected' in effect && effect.connected) {
      // Listen to the source gadget for changes
      const source = state.instances[effect.connected?.from];
      const target = state.instances[effect.connected?.to];
      if (source && target && 'tap' in source && typeof source.tap === 'function') {
        (source as any).tap((sourceEffect: any) => {
          if ('changed' in sourceEffect && sourceEffect.changed !== undefined) {
            setFlowHistory(prev => [
              ...prev.slice(-19), // Keep last 20 items
              {
                from: effect.connected!.from,
                to: effect.connected!.to,
                value: sourceEffect.changed,
                timestamp: Date.now()
              }
            ]);
          }
        });
      }
    }
  }, [state]);

  // Update React Flow graph when state changes
  const updateFlowGraph = useCallback((basslineState: typeof state) => {
    // Create nodes from instances
    const newNodes: Node[] = Object.entries(basslineState.instances).map(
      ([name, gadget], index) => {
        const type = Object.entries(typeRegistry).find(
          ([_, factory]) => {
            // Compare the gadget type by checking initial value
            const testGadget = factory(0);
            return testGadget.constructor.name === gadget.constructor.name;
          }
        )?.[0] || 'unknown';

        return {
          id: name,
          position: {
            x: 150 * (index % 3),
            y: 150 * Math.floor(index / 3)
          },
          data: {
            label: (
              <div className="text-center">
                <div className="font-bold">{name}</div>
                <div className="text-xs text-gray-500">{type}</div>
                <div className="text-sm mt-1">{JSON.stringify(gadget.current())}</div>
              </div>
            )
          },
          style: {
            background: type === 'max' ? '#fef3c7' : type === 'min' ? '#dbeafe' : '#e9d5ff',
            border: '1px solid #6b7280',
            borderRadius: '8px',
            padding: '10px',
          },
        };
      }
    );

    // Create edges from connections
    const newEdges: Edge[] = Object.entries(basslineState.connections).map(
      ([id, conn]: [string, any]) => ({
        id,
        source: conn.data.from,
        target: conn.data.to,
        animated: true,
        style: { stroke: '#6b7280' },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 20,
          height: 20,
          color: '#6b7280',
        },
      })
    );

    setNodes(newNodes);
    setEdges(newEdges);
  }, [setNodes, setEdges]);

  const createInstance = () => {
    if (instanceName) {
      send({
        spawn: {
          name: instanceName,
          type: selectedType,
          args: [selectedType === 'min' ? 100 : 0]
        }
      });
      setInstanceName("");
    }
  };

  const createConnection = () => {
    if (fromInstance && toInstance) {
      send({
        connect: {
          id: `${fromInstance}-${toInstance}-${Date.now()}`,
          from: fromInstance,
          to: toInstance,
          pattern: 'extract'
        }
      });
      setFromInstance("");
      setToInstance("");
    }
  };

  const sendValue = () => {
    if (selectedInstance && testValue) {
      const gadget = state.instances[selectedInstance];
      if (gadget) {
        const value = isNaN(Number(testValue)) ? testValue : Number(testValue);
        gadget.receive(value);
        setTestValue("");
      }
    }
  };

  const deleteInstance = (name: string) => {
    send({ destroy: name });
  };

  // Handle React Flow connections
  const onConnect = useCallback(
    (params: Connection) => {
      if (params.source && params.target) {
        send({
          connect: {
            id: `${params.source}-${params.target}-${Date.now()}`,
            from: params.source,
            to: params.target,
            pattern: 'extract'
          }
        });
      }
    },
    [send]
  );


  return (
    <div className="p-4">
      <h1 className="text-3xl font-bold mb-6">Bassline Playground</h1>

      {/* Visual Graph */}
      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Network Visualization</CardTitle>
        </CardHeader>
        <CardContent>
          <div style={{ height: 400 }}>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              //nodeTypes={nodeTypes}
              //edgeTypes={edgeTypes}
              fitView
              proOptions={{ hideAttribution: true }}
            >
              <Background />
              <Controls />
              <MiniMap />
            </ReactFlow>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Builder Panel */}
        <Card>
          <CardHeader>
            <CardTitle>Create Instance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Type</Label>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="w-full p-2 border rounded"
              >
                {Object.keys(typeRegistry).map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>

            <div>
              <Label>Name</Label>
              <Input
                value={instanceName}
                onChange={(e) => setInstanceName(e.target.value)}
                placeholder="Instance name..."
                onKeyDown={(e) => {
                  if (e.key === 'Enter') createInstance();
                }}
              />
            </div>

            <Button onClick={createInstance} className="w-full">
              Create Instance
            </Button>

            <div className="border-t pt-4">
              <h4 className="font-semibold mb-2">Instances ({Object.keys(state.instances).length})</h4>
              <div className="space-y-1">
                {Object.entries(state.instances).map(([name, gadget]) => (
                  <div
                    key={name}
                    className="flex items-center justify-between p-2 border rounded hover:bg-gray-50"
                  >
                    <span className="text-sm">
                      {name}: <strong>{JSON.stringify(gadget.current())}</strong>
                    </span>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => deleteInstance(name)}
                    >
                      ×
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Connection Panel */}
        <Card>
          <CardHeader>
            <CardTitle>Create Connection</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>From</Label>
              <select
                value={fromInstance}
                onChange={(e) => setFromInstance(e.target.value)}
                className="w-full p-2 border rounded"
              >
                <option value="">Select source...</option>
                {Object.keys(state.instances).map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>

            <div>
              <Label>To</Label>
              <select
                value={toInstance}
                onChange={(e) => setToInstance(e.target.value)}
                className="w-full p-2 border rounded"
              >
                <option value="">Select target...</option>
                {Object.keys(state.instances).map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>

            <Button onClick={createConnection} className="w-full">
              Connect
            </Button>

            <div className="border-t pt-4">
              <h4 className="font-semibold mb-2">Connections ({Object.keys(state.connections).length})</h4>
              <div className="space-y-1">
                {Object.entries(state.connections).map(([id, conn]: [string, any]) => (
                  <div key={id} className="p-2 border rounded text-sm">
                    {conn.data.from} → {conn.data.to}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="ml-2"
                      onClick={() => bassline.receive({ disconnect: id })}
                    >
                      ×
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Test Panel */}
        <Card>
          <CardHeader>
            <CardTitle>Test Values</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Send to Instance</Label>
              <select
                value={selectedInstance || ""}
                onChange={(e) => setSelectedInstance(e.target.value)}
                className="w-full p-2 border rounded"
              >
                <option value="">Select instance...</option>
                {Object.keys(state.instances).map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>

            {selectedInstance && (
              <>
                <div className="text-sm text-gray-600">
                  Current: <strong>{JSON.stringify(state.instances[selectedInstance]?.current())}</strong>
                </div>

                <div>
                  <Input
                    value={testValue}
                    onChange={(e) => setTestValue(e.target.value)}
                    placeholder="Enter value..."
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') sendValue();
                    }}
                  />
                </div>

                <Button onClick={sendValue} className="w-full">
                  Send Value
                </Button>
              </>
            )}

            <div className="border-t pt-4">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  // Create example network
                  send({ spawn: { name: 'input', type: 'max', args: [0] } });
                  send({ spawn: { name: 'processor', type: 'min', args: [100] } });
                  send({ spawn: { name: 'output', type: 'last', args: [null] } });

                  setTimeout(() => {
                    send({
                      connect: {
                        id: 'link1',
                        from: 'input',
                        to: 'processor'
                      }
                    });
                    send({
                      connect: {
                        id: 'link2',
                        from: 'processor',
                        to: 'output'
                      }
                    });
                  }, 100);
                }}
              >
                Create Example Network
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Data Flow History */}
      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Data Flow History</CardTitle>
        </CardHeader>
        <CardContent>
          {flowHistory.length > 0 ? (
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {flowHistory.map((flow, i) => (
                <div key={i} className="text-xs font-mono p-1 bg-gray-100 rounded">
                  {new Date(flow.timestamp).toLocaleTimeString()}: {flow.from} → {flow.to} = {JSON.stringify(flow.value)}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No data flow yet. Send values through connected instances to see the flow.</p>
          )}
        </CardContent>
      </Card>

      {/* Instructions */}
      <Card className="mt-4">
        <CardHeader>
          <CardTitle>How It Works</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="prose text-sm">
            <p>This playground demonstrates the bassline factory system:</p>
            <ul>
              <li><strong>max</strong> cells: Keep the maximum value seen</li>
              <li><strong>min</strong> cells: Keep the minimum value seen</li>
              <li><strong>last</strong> cells: Keep the most recent value</li>
            </ul>
            <p>Create instances, connect them together, and send values to see how data flows through the network!</p>
            <p className="mt-2">You can also drag nodes in the visualization and connect them by dragging from one node to another.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function BasslinePlayground() {
  // Create the bassline instance directly
  const [bassline] = useState(() => withTaps(factoryBassline(typeRegistry)));

  return <BasslinePlaygroundContent bassline={bassline} />;
}