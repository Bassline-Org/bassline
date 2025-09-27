import React from 'react';
import type { Gadget, Tappable, StateOf, SpecOf } from 'port-graphs';
import { useGadget } from 'port-graphs-react';

interface GadgetDisplayProps<S, G extends Gadget<S> & Tappable<S>> {
  gadget: G;
  className?: string;
  formatter?: (state: StateOf<SpecOf<G>>) => React.ReactNode;
  title?: string;
}

/**
 * Simple component to display a gadget's state
 */
export function GadgetDisplay<S, G extends Gadget<S> & Tappable<S>>({
  gadget,
  className,
  formatter,
  title
}: GadgetDisplayProps<S, G>) {
  const [state] = useGadget<S, G>(gadget);

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