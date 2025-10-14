import { createContext, useContext, useState, ReactNode, useMemo } from "react";

interface REPLContextValue {
    repl: any;
    version: number;
}

const REPLContext = createContext<REPLContextValue | null>(null);

interface REPLProviderProps {
    children: ReactNode;
    repl: any;
}

export function REPLProvider({ children, repl }: REPLProviderProps) {
    const [version, setVersion] = useState(0);

    // Wrap repl.eval to track when context changes
    const wrappedRepl = useMemo(() => {
        return {
            ...repl,
            eval: async (code: string) => {
                const result = await repl.eval(code);
                // Increment version to trigger re-renders
                setVersion((v) => v + 1);
                return result;
            },
        };
    }, [repl]);

    return (
        <REPLContext.Provider value={{ repl: wrappedRepl, version }}>
            {children}
        </REPLContext.Provider>
    );
}

export function useREPL() {
    const context = useContext(REPLContext);
    if (!context) {
        throw new Error("useREPL must be used within a REPLProvider");
    }
    return context;
}

/**
 * Hook that returns the current REPL version
 * Components that call this will re-render whenever the REPL context changes
 */
export function useReplVersion() {
    const { version } = useREPL();
    return version;
}
