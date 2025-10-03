import { useState, useEffect } from 'react';
import { renderGadgetValue, type RenderOptions } from '~/lib/renderGadgetValue';

interface GadgetValueDisplayProps {
  gadget: any;
  options?: RenderOptions;
  className?: string;
}

/**
 * React component that displays a gadget's current value with smart rendering
 * and automatic updates via taps
 */
export function GadgetValueDisplay({ gadget, options, className }: GadgetValueDisplayProps) {
  const [value, setValue] = useState(() => gadget.current());

  useEffect(() => {
    const cleanup = gadget.tap(() => {
      setValue(gadget.current());
    });
    return cleanup;
  }, [gadget]);

  return (
    <div className={className}>
      {renderGadgetValue(value, gadget.metadata, options)}
    </div>
  );
}

interface StaticValueDisplayProps {
  value: any;
  metadata?: any;
  options?: RenderOptions;
  className?: string;
}

/**
 * Display a static value (not reactive) with smart rendering
 */
export function StaticValueDisplay({ value, metadata, options, className }: StaticValueDisplayProps) {
  return (
    <div className={className}>
      {renderGadgetValue(value, metadata, options)}
    </div>
  );
}
