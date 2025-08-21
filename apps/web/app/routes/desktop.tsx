/**
 * Desktop Route - The propagation network desktop environment
 */

import type { Route } from "./+types/desktop";
import { NetworkProvider } from "../../../../atto-bassline/src/react-templates";
import { Desktop } from "../../../../atto-bassline/src/desktop-component";
import { Calculator } from "../../../../atto-bassline/src/calculator-component";
import { CalculatorTemplate } from "../../../../atto-bassline/src/calculator-app";
import { Oscillator } from "../../../../atto-bassline/src/oscillator-component";
import { OscillatorTemplate } from "../../../../atto-bassline/src/oscillator-app";
import { Sequencer } from "../../../../atto-bassline/src/sequencer-component";
import { SequencerTemplate } from "../../../../atto-bassline/src/sequencer-app";
import { SliderTemplate, TextFieldTemplate } from "../../../../atto-bassline/src/templates-v2";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Bassline Desktop" },
    { name: "description", content: "Propagation network desktop environment" },
  ];
}

// Create application registry
const applicationRegistry = new Map([
  ['calculator', CalculatorTemplate],
  ['oscillator', OscillatorTemplate],
  ['sequencer', SequencerTemplate],
  ['slider', SliderTemplate], 
  ['textfield', TextFieldTemplate],
]);

// Component to render application content based on template name
function ApplicationContent({ templateName, appId }: { templateName: string, appId: string }) {
  console.log('ApplicationContent: templateName =', templateName, 'appId =', appId)
  switch (templateName) {
    case 'calculator':
      return <Calculator appId={appId} />
    
    case 'oscillator':
      return <Oscillator appId={appId} />
    
    case 'sequencer':
      return <Sequencer appId={appId} />
    
    case 'slider':
      return (
        <div className="p-4 h-full">
          <h3 className="text-lg font-semibold mb-4">Slider App</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Value Slider
              </label>
              <input
                type="range"
                min="0"
                max="100"
                defaultValue="50"
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Color Slider
              </label>
              <input
                type="range"
                min="0"
                max="255"
                defaultValue="128"
                className="w-full"
              />
            </div>
          </div>
          <div className="text-sm text-gray-500 mt-4">
            App ID: {appId}
          </div>
        </div>
      )
    
    case 'textfield':
      return (
        <div className="p-4 h-full flex flex-col">
          <h3 className="text-lg font-semibold mb-4">Text Editor</h3>
          <textarea
            className="flex-1 p-3 border border-gray-300 rounded resize-none"
            placeholder="Type something..."
            defaultValue="Welcome to the Bassline Desktop!\n\nThis is a simple text editor running as an application in the propagation network desktop environment."
          />
          <div className="text-sm text-gray-500 mt-2">
            App ID: {appId}
          </div>
        </div>
      )
    
    default:
      return (
        <div className="p-4">
          <h3 className="text-lg font-semibold mb-2">Unknown Application</h3>
          <p className="text-gray-600">
            Application type: {templateName}
          </p>
          <p className="text-sm text-gray-500 mt-2">
            App ID: {appId}
          </p>
        </div>
      )
  }
}

export default function DesktopRoute() {
  return (
    <NetworkProvider>
      <div className="w-screen h-screen overflow-hidden bg-gray-900">
        <Desktop 
          applicationRegistry={applicationRegistry}
          renderApplication={(templateName, appId) => <ApplicationContent templateName={templateName} appId={appId} />}
        >
          {/* Desktop welcome message */}
          <div className="absolute top-4 left-4 text-white/80 text-sm font-mono pointer-events-none">
            <div className="bg-black/20 p-3 rounded-lg backdrop-blur-sm">
              <div className="font-semibold">Bassline Desktop Environment</div>
              <div className="text-xs mt-1 text-white/60">
                Click "Apps" in the taskbar to open applications
              </div>
              <div className="text-xs mt-1 text-white/60">
                Try opening multiple Calculator instances!
              </div>
            </div>
          </div>
        </Desktop>
      </div>
    </NetworkProvider>
  );
}