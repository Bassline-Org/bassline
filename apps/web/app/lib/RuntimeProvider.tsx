import { createRuntime } from "@bassline/lang/runtime";
import * as prelude from "@bassline/lang/prelude";
import { parse } from "@bassline/lang";
import { createContext, useCallback, useContext, useRef } from "react";

export const RuntimeContext = createContext<any>(null);

export const RuntimeProvider = (
    { children }: { children: React.ReactNode },
) => {
    const runtime = useRef(createRuntime());
    return (
        <RuntimeContext.Provider value={runtime.current}>
            {children}
        </RuntimeContext.Provider>
    );
};

export const useRuntime = () => {
    return useContext(RuntimeContext);
};

export const useEvaluate = () => {
    const runtime = useRuntime();
    return useCallback((code: string) => {
        const parsed = parse(code);
        return runtime.evaluate(parsed);
    }, [runtime]);
};
