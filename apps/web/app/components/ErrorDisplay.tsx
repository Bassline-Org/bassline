import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { AlertCircle } from "lucide-react";

interface ErrorDisplayProps {
    error: string;
    onDismiss?: () => void;
}

export function ErrorDisplay({ error, onDismiss }: ErrorDisplayProps) {
    return (
        <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription className="font-mono text-sm">
                {error}
            </AlertDescription>
            {onDismiss && (
                <button
                    onClick={onDismiss}
                    className="absolute top-2 right-2 text-red-600 hover:text-red-800"
                >
                    ✕
                </button>
            )}
        </Alert>
    );
}
