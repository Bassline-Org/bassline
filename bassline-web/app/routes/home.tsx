import type { Route } from "./+types/home";
import { Link, Form, redirect, useActionData, useNavigation } from "react-router";
import { Button } from "~/components/ui/button";
import { useRef, useEffect } from "react";
import { toast } from "sonner";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Bassline" },
    { name: "description", content: "Propagation networks" },
  ];
}

// Server action to handle file upload
export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const file = formData.get("basslineFile") as File;
  
  if (!file || file.size === 0) {
    return { error: "No file uploaded" };
  }
  
  try {
    const text = await file.text();
    const template = JSON.parse(text);
    
    // Validate the template
    if (!template.rootGroup) {
      return { error: "Invalid bassline format: missing rootGroup" };
    }
    
    // Store in a temporary location (in production, you'd use a proper storage solution)
    // For now, we'll encode it in the URL as a base64 string
    const encodedTemplate = Buffer.from(text).toString('base64');
    
    // Redirect to the editor with the encoded template
    return redirect(`/editor/uploaded?data=${encodedTemplate}&name=${encodeURIComponent(file.name.replace('.json', ''))}`);
  } catch (error) {
    return { error: "Failed to parse bassline file" };
  }
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
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isUploading = navigation.state === "submitting";
  
  useEffect(() => {
    if (actionData?.error) {
      toast.error(actionData.error);
    }
  }, [actionData]);
  
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
          <Form method="post" encType="multipart/form-data">
            <div 
              className="border border-dashed border-slate-300 rounded-lg p-6 hover:border-slate-400 hover:shadow-lg transition-all cursor-pointer"
              onClick={() => !isUploading && fileInputRef.current?.click()}
            >
              <h2 className="text-xl font-semibold mb-2">Load from File</h2>
              <p className="text-slate-600 mb-4">
                Upload a bassline JSON file from your computer
              </p>
              <Button 
                type="button" 
                variant="secondary" 
                disabled={isUploading}
              >
                {isUploading ? "Uploading..." : "Choose File"}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                name="basslineFile"
                accept=".json"
                onChange={(e) => {
                  if (e.target.files?.[0]) {
                    e.target.form?.requestSubmit();
                  }
                }}
                className="hidden"
              />
            </div>
          </Form>
        </div>
      </div>
    </div>
  );
}