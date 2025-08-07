import type { MetaFunction } from "react-router";
import { BasslineBrowser } from "~/components/BasslineBrowser";
import { useSoundToast } from "~/hooks/useSoundToast";

export const meta: MetaFunction = () => {
  return [
    { title: "Bassline Browser - Explore Propagation Networks" },
    { name: "description", content: "Browse and import bassline manifests" },
  ];
};

export default function BasslineBrowserPage() {
  const toast = useSoundToast();
  
  const handleImport = (bassline: any) => {
    toast.success(`Importing ${bassline.name} v${bassline.version}...`);
    // TODO: Implement actual import logic
    console.log('Import bassline:', bassline);
  };
  
  const handlePreview = (bassline: any) => {
    toast.info(`Preview for ${bassline.name} coming soon!`);
    // TODO: Implement preview logic
    console.log('Preview bassline:', bassline);
  };
  
  return (
    <div className="h-screen w-screen bg-background overflow-hidden">
      <BasslineBrowser 
        onImport={handleImport}
        onPreview={handlePreview}
      />
    </div>
  );
}