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
    "Multiple Gadgets": `[
  ["spawn", "counter1", {
    "pkg": "@bassline/cells/numeric",
    "name": "max",
    "state": 0
  }],
  ["spawn", "counter2", {
    "pkg": "@bassline/cells/numeric",
    "name": "max",
    "state": 10
  }],
  ["spawn", "display", {
    "pkg": "@bassline/cells/unsafe",
    "name": "last",
    "state": "hello"
  }]
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
