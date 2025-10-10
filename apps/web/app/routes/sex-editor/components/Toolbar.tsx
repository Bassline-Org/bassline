import { Button } from "~/components/ui/button";

interface ToolbarProps {
    onNew: () => void;
    onSave: () => void;
    onLoad: () => void;
    onExport: () => void;
}

export function Toolbar({ onNew, onSave, onLoad, onExport }: ToolbarProps) {
    return (
        <div className="bg-gray-900 text-white px-4 py-2 flex items-center justify-between">
            <h1 className="text-lg font-semibold">Sex Editor</h1>
            <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={onNew}>
                    New
                </Button>
                <Button size="sm" variant="outline" onClick={onSave}>
                    Save
                </Button>
                <Button size="sm" variant="outline" onClick={onLoad}>
                    Load
                </Button>
                <Button size="sm" variant="outline" onClick={onExport}>
                    Export Package
                </Button>
            </div>
        </div>
    );
}
