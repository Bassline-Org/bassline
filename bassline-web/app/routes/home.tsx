import type { Route } from "./+types/home";
import { Link, useNavigate } from "react-router";
import { Button } from "~/components/ui/button";
import { useRef } from "react";
import { toast } from "sonner";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Bassline" },
    { name: "description", content: "Propagation networks" },
  ];
}

// Available basslines - in a real app, this might come from a loader
const basslines = [
  {
    name: "simple",
    title: "Simple Network",
    description: "A basic network with two contacts and a connection",
  },
  {
    name: "gadget-example",
    title: "Gadget Example",
    description: "A network with a custom gadget that has boundary contacts",
  },
  {
    name: "complex",
    title: "Complex Network",
    description: "A complex network with multiple gadgets and connections",
  },
];

export default function Home() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    try {
      const text = await file.text();
      const template = JSON.parse(text);
      
      // Store the template in sessionStorage
      sessionStorage.setItem('uploadedBassline', text);
      sessionStorage.setItem('uploadedBasslineName', file.name.replace('.json', ''));
      
      // Navigate to a special route for uploaded basslines
      navigate('/editor/uploaded');
    } catch (error) {
      console.error('Failed to load bassline:', error);
      toast.error('Failed to load bassline. Please check the file format.');
    }
  };
  
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="container mx-auto py-12 px-4">
        <h1 className="text-4xl font-bold mb-8">Bassline</h1>
        <p className="text-lg text-slate-600 mb-12">
          Visual programming with propagation networks. Choose a bassline to start grooving:
        </p>
        
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {/* Default editor */}
          <Link to="/editor" className="block">
            <div className="border border-slate-200 rounded-lg p-6 hover:border-slate-300 hover:shadow-lg transition-all">
              <h2 className="text-xl font-semibold mb-2">New Network</h2>
              <p className="text-slate-600 mb-4">
                Start with a blank canvas or the default example network
              </p>
              <Button>Start Fresh</Button>
            </div>
          </Link>
          
          {/* Bassline templates */}
          {basslines.map((bassline) => (
            <Link key={bassline.name} to={`/editor/${bassline.name}`} className="block">
              <div className="border border-slate-200 rounded-lg p-6 hover:border-slate-300 hover:shadow-lg transition-all">
                <h2 className="text-xl font-semibold mb-2">{bassline.title}</h2>
                <p className="text-slate-600 mb-4">
                  {bassline.description}
                </p>
                <Button variant="outline">Load Bassline</Button>
              </div>
            </Link>
          ))}
          
          {/* Load from file */}
          <div 
            className="border border-dashed border-slate-300 rounded-lg p-6 hover:border-slate-400 hover:shadow-lg transition-all cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
          >
            <h2 className="text-xl font-semibold mb-2">Load from File</h2>
            <p className="text-slate-600 mb-4">
              Upload a bassline JSON file from your computer
            </p>
            <Button variant="secondary">Choose File</Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>
        </div>
      </div>
    </div>
  );
}