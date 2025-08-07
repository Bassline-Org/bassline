import type { MetaFunction } from "react-router";
import { useSearchParams } from "react-router";
import { NetworkStateProvider } from "~/propagation-react/contexts/NetworkState";
import { ReactFlowProvider } from "~/propagation-react/contexts/ReactFlowContext";
import { ModeProvider } from "~/propagation-react/contexts/ModeContext";
import { SoundContextProvider } from "~/propagation-react/contexts/SoundContext";
import { SoundSystemProvider } from "~/components/SoundSystem";
import { SimpleEditor } from "~/components/SimpleEditor";
import { Toaster } from "~/components/ui/sonner";
import "@xyflow/react/dist/style.css";

export const meta: MetaFunction = () => {
  return [
    { title: "Simple Editor - Bassline" },
    { name: "description", content: "Clean React-based editor" },
  ];
};

export default function SimpleEditorPage() {
  const [searchParams] = useSearchParams();
  const groupId = searchParams.get('group');
  
  return (
    <SoundContextProvider>
      <SoundSystemProvider>
        <ModeProvider>
          <NetworkStateProvider initialGroupId={groupId}>
            <ReactFlowProvider>
              <SimpleEditor />
            </ReactFlowProvider>
          </NetworkStateProvider>
          <Toaster />
        </ModeProvider>
      </SoundSystemProvider>
    </SoundContextProvider>
  );
}