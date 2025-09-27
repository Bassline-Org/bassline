import React, { useEffect } from 'react';
import type { Gadget, Tappable, StateOf } from 'port-graphs';
import { useGadget } from 'port-graphs-react';

interface DisplayWidgetProps<S, G extends Gadget<S> & Tappable<S>> {
  display: G;
  cleanup?: () => void,
  className?: string;
  formatter?: (state: StateOf<S>) => React.ReactNode;
}


export function DisplayWidget<S, G extends Gadget<S> & Tappable<S>>({
  display,
  cleanup,
  className,
  formatter
}: {
  display: G;
  cleanup?: () => void,
  className?: string;
  formatter?: (state: StateOf<S>) => React.ReactNode;
}) {
  const [state] = useGadget<S, G>(display);

  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  return (
    <div className={`p-4 ${className || ''}`}>
      {formatter ? formatter(state) : (
        <pre className="text-sm bg-gray-50 p-3 rounded overflow-auto">
          {JSON.stringify(state, null, 2)}
        </pre>
      )}
    </div>
  );
}