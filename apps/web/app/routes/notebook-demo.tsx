import type { Route } from "./+types/notebook-demo";
import { GadgetProvider, useGadget } from 'port-graphs-react';
import {
  withTaps,
  maxCell,
  unionCell,
  sliderGadget,
  type Gadget,
  type Tappable,
  type CellSpec,
  type SetCell,
} from 'port-graphs';
import {
  Notebook,
  NotebookSection,
  DisplayWidget,
  ControlWidget,
  TextWidget,
  type Widget,
} from '../notebook';

export function meta({ }: Route.MetaArgs) {
  return [
    { title: "Notebook Demo - Bassline" },
    { name: "description", content: "Demonstrating the notebook widget system" },
  ];
}

const bidirectionalWidget = () => {
  const primary = withTaps(maxCell(10));
  const secondary = withTaps(maxCell(10));

  // Wire them bidirectionally
  const c1 = primary.tap(({ changed }) => {
    if (changed !== undefined) secondary.receive(changed);
  });
  const c2 = secondary.tap(({ changed }) => {
    if (changed !== undefined) primary.receive(changed);
  });

  return {
    gadgets: { primary, secondary },
    cleanup: () => { c1(); c2(); }
  };
}

const { gadgets, cleanup } = bidirectionalWidget();

function NotebookDemoInner() {
  return (
    <Notebook
      title="Notebook Widget System Demo"
      description="Showcasing different patterns of gadget composition and multi-directional influences"
    >
      <NotebookSection title="Bidirectional Sync Pattern">
        <TextWidget content="Two maxCell gadgets synced bidirectionally - updating one updates the other." />
        <DisplayWidget display={gadgets.primary} />
        <DisplayWidget display={gadgets.secondary} />
      </NotebookSection>
    </Notebook>
  );
}

export default function NotebookDemo() {
  return (
    <GadgetProvider>
      <NotebookDemoInner />
    </GadgetProvider>
  );
}