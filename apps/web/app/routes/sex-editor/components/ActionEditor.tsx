import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/textarea";

const EXAMPLES = {
    "Create Counter": `[
  ["spawn", "counter", {
    "pkg": "@bassline/cells/numeric",
    "name": "max",
    "state": 0
  }]
]`,
    "Send to Gadget": `[
  ["send", "counter", 42]
]`,
    "Simple Wire": `[
  ["spawn", "sensor", {
    "pkg": "@bassline/cells/numeric",
    "name": "max",
    "state": 0
  }],
  ["spawn", "display", {
    "pkg": "@bassline/cells/unsafe",
    "name": "last",
    "state": 0
  }],
  ["wire", "sensorToDisplay", "sensor", "display"]
]`,
    "Function Pipeline": `[
  ["spawn", "input", {
    "pkg": "@bassline/cells/numeric",
    "name": "max",
    "state": 0
  }],
  ["spawn", "doubler", {
    "pkg": "@bassline/fn/math",
    "name": "mul",
    "state": { "args": { "b": 2 } }
  }],
  ["spawn", "output", {
    "pkg": "@bassline/cells/unsafe",
    "name": "last",
    "state": 0
  }],
  ["wire", "inputToDoubler", "input", "doubler"],
  ["wire", "doublerToOutput", "doubler", "output"]
]`,
    "Fan-out": `[
  ["spawn", "source", {
    "pkg": "@bassline/cells/numeric",
    "name": "max",
    "state": 0
  }],
  ["spawn", "target1", {
    "pkg": "@bassline/cells/unsafe",
    "name": "last",
    "state": 0
  }],
  ["spawn", "target2", {
    "pkg": "@bassline/cells/unsafe",
    "name": "last",
    "state": 0
  }],
  ["wire", "wire1", "source", "target1"],
  ["wire", "wire2", "source", "target2"]
]`,
    "Nested Workspace": `[
  ["spawn", "workspace", {
    "pkg": "@bassline/systems",
    "name": "sex",
    "state": []
  }]
]`,
    "With Values": `[
  ["val", "initial", 42],
  ["withVals", ["initial"], [
    "spawn", "counter", {
      "pkg": "@bassline/cells/numeric",
      "name": "max",
      "state": { "$val": "initial" }
    }
  ]]
]`,
};

interface ActionEditorProps {
    actions: string;
    onActionsChange: (actions: string) => void;
    onExecute: () => void;
}

export function ActionEditor({
    actions,
    onActionsChange,
    onExecute,
}: ActionEditorProps) {
    return (
        <div className="h-full flex flex-col p-4">
            <div className="mb-2 flex gap-2 items-center justify-end">
                <select
                    className="text-xs border rounded px-2 py-1"
                    onChange={(e) => {
                        const example = EXAMPLES[
                            e.target.value as keyof typeof EXAMPLES
                        ];
                        if (example) onActionsChange(example);
                    }}
                    defaultValue=""
                >
                    <option value="">Load Example...</option>
                    {Object.keys(EXAMPLES).map((key) => (
                        <option key={key} value={key}>
                            {key}
                        </option>
                    ))}
                </select>
                <Button onClick={onExecute}>Execute</Button>
            </div>
            <Textarea
                value={actions || "[]"}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                    onActionsChange(e.target.value)}
                className="flex-1 font-mono text-sm"
                placeholder="Enter actions as JSON array..."
            />
        </div>
    );
}
