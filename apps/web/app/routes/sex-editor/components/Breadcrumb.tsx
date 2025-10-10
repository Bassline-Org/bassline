interface BreadcrumbProps {
    navigationStack: Array<{ sex: any; name: string; parentSex?: any }>;
    onNavigateToLevel: (index: number) => void;
}

export function Breadcrumb({ navigationStack, onNavigateToLevel }: BreadcrumbProps) {
    return (
        <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 border-b text-sm">
            <span className="text-gray-500">📍</span>
            {navigationStack.map((frame, index) => (
                <div key={index} className="flex items-center gap-2">
                    {index > 0 && <span className="text-gray-400">›</span>}
                    <button
                        onClick={() => onNavigateToLevel(index)}
                        className={`font-mono hover:text-blue-600 transition-colors ${
                            index === navigationStack.length - 1
                                ? "text-blue-600 font-semibold"
                                : "text-gray-600"
                        }`}
                        disabled={index === navigationStack.length - 1}
                    >
                        {frame.name}
                    </button>
                </div>
            ))}
        </div>
    );
}
