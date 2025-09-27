import React from 'react';
import { useGadget } from 'port-graphs-react';
import type { Gadget, SpecOf, StateOf, Tappable } from 'port-graphs';

interface GadgetDisplayProps<S> {
  gadget: Gadget<S> & Tappable<S>;
  className?: string;
  formatter?: (state: StateOf<S>) => React.ReactNode;
  title?: string;
}

/**
 * Simple component to display a gadget's state
 */
export function GadgetDisplay<S>({
  gadget,
  className,
  formatter,
  title
}: GadgetDisplayProps<S>) {
  const [state] = useGadget<S, typeof gadget>(gadget);
  const content = formatter ? formatter(state) : (
    <pre className="text-sm bg-gray-50 p-3 rounded overflow-auto">
      {JSON.stringify(state, null, 2)}
    </pre>
  );

  return (
    <div className={className}>
      {title && <h3 className="text-sm font-medium mb-2">{title}</h3>}
      {content}
    </div>
  );
}