import { useState, useEffect } from "react";
import { Textarea } from "~/components/ui/textarea";
import { Button } from "~/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "~/components/ui/select";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "~/components/ui/dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Input } from "~/components/ui/input";
import { useScriptStorage } from "~/hooks/useScriptStorage";
import { Save, MoreVertical, Trash2, FileEdit } from "lucide-react";

interface ReplInputProps {
    onExecute: (input: string) => void;
}

export function ReplInput({ onExecute }: ReplInputProps) {
    const [input, setInput] = useState("");
    const [saveDialogOpen, setSaveDialogOpen] = useState(false);
    const [renameDialogOpen, setRenameDialogOpen] = useState(false);
    const [scriptName, setScriptName] = useState("");

    const {
        scripts,
        currentScript,
        setCurrentScript,
        saveScript,
        loadScript,
        deleteScript,
        saveDraft,
        renameScript,
    } = useScriptStorage();

    // Load initial draft or selected script
    useEffect(() => {
        const script = loadScript(currentScript);
        if (script) {
            setInput(script.code);
        }
    }, [currentScript, loadScript]);

    // Auto-save draft every 2 seconds
    useEffect(() => {
        if (currentScript === "draft") {
            const timer = setTimeout(() => {
                saveDraft(input);
            }, 2000);

            return () => clearTimeout(timer);
        }
    }, [input, currentScript, saveDraft]);

    const handleSubmit = () => {
        if (!input.trim()) return;
        onExecute(input);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            handleSubmit();
        } else if (e.key === "Tab") {
            e.preventDefault();
            const textarea = e.currentTarget;
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            const spaces = "    "; // 4 spaces

            // Insert 4 spaces at cursor position
            const newValue = input.substring(0, start) + spaces + input.substring(end);
            setInput(newValue);

            // Move cursor after the inserted spaces
            setTimeout(() => {
                textarea.selectionStart = textarea.selectionEnd = start + spaces.length;
            }, 0);
        }
    };

    const handleScriptChange = (name: string) => {
        setCurrentScript(name);
    };

    const handleSave = () => {
        if (!scriptName.trim()) return;

        const success = saveScript(scriptName, input);
        if (success) {
            setCurrentScript(scriptName);
            setSaveDialogOpen(false);
            setScriptName("");
        }
    };

    const handleDelete = () => {
        if (currentScript === "draft") return;

        const success = deleteScript(currentScript);
        if (success) {
            setCurrentScript("draft");
        }
    };

    const handleRename = () => {
        if (!scriptName.trim() || currentScript === "draft") return;

        const success = renameScript(currentScript, scriptName);
        if (success) {
            setCurrentScript(scriptName);
            setRenameDialogOpen(false);
            setScriptName("");
        }
    };

    return (
        <div className="space-y-2">
            {/* Script Management Toolbar */}
            <div className="flex gap-2 items-center">
                <span className="text-xs text-slate-600 font-medium">Script:</span>
                <Select value={currentScript} onValueChange={handleScriptChange}>
                    <SelectTrigger className="w-[200px] h-8 text-xs">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="draft">Draft (auto-saved)</SelectItem>
                        {scripts.map((name) => (
                            <SelectItem key={name} value={name}>
                                {name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <Button
                    onClick={() => setSaveDialogOpen(true)}
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1"
                >
                    <Save className="w-3 h-3" />
                    Save As
                </Button>

                {currentScript !== "draft" && (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                <MoreVertical className="w-4 h-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem
                                onClick={() => {
                                    setScriptName(currentScript);
                                    setRenameDialogOpen(true);
                                }}
                            >
                                <FileEdit className="w-4 h-4 mr-2" />
                                Rename
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                onClick={handleDelete}
                                className="text-red-600"
                            >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Delete
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                )}
            </div>

            {/* Code Input */}
            <div className="flex gap-2 items-start">
                <Textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="query where { ?person age ?age * }&#x0a;&#x0a;Press Cmd+Enter (or Ctrl+Enter) to run"
                    className="flex-1 font-mono text-sm min-h-[60px]"
                    rows={3}
                />
                <Button onClick={handleSubmit} variant="default" size="sm">
                    Run
                </Button>
            </div>

            {/* Save Dialog */}
            <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Save Script</DialogTitle>
                        <DialogDescription>
                            Enter a name for your script
                        </DialogDescription>
                    </DialogHeader>
                    <Input
                        value={scriptName}
                        onChange={(e) => setScriptName(e.target.value)}
                        placeholder="my-script"
                        onKeyDown={(e) => {
                            if (e.key === "Enter") {
                                e.preventDefault();
                                handleSave();
                            }
                        }}
                    />
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => {
                                setSaveDialogOpen(false);
                                setScriptName("");
                            }}
                        >
                            Cancel
                        </Button>
                        <Button onClick={handleSave}>Save</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Rename Dialog */}
            <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Rename Script</DialogTitle>
                        <DialogDescription>
                            Enter a new name for "{currentScript}"
                        </DialogDescription>
                    </DialogHeader>
                    <Input
                        value={scriptName}
                        onChange={(e) => setScriptName(e.target.value)}
                        placeholder="new-name"
                        onKeyDown={(e) => {
                            if (e.key === "Enter") {
                                e.preventDefault();
                                handleRename();
                            }
                        }}
                    />
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => {
                                setRenameDialogOpen(false);
                                setScriptName("");
                            }}
                        >
                            Cancel
                        </Button>
                        <Button onClick={handleRename}>Rename</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
