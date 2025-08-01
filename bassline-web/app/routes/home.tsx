import type { Route } from "./+types/home";
import { PropagationNetworkEditorWithProvider } from "~/components/PropagationNetworkEditor";
import { PropagationProvider } from "~/contexts/PropagationContext";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Bassline - Propagation Network Editor" },
    { name: "description", content: "Visual programming with propagation networks" },
  ];
}

export default function Home() {
  return (
    <PropagationProvider>
      <PropagationNetworkEditorWithProvider />
    </PropagationProvider>
  );
}
