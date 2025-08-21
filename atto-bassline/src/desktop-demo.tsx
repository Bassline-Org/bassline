/**
 * Desktop Demo - Shows the complete desktop environment
 */

import React from 'react'
import { NetworkProvider } from './react-templates'
import { Desktop } from './desktop-component'
import { Calculator } from './calculator-component'
import { CalculatorTemplate } from './calculator-app'
import { SliderTemplate, TextFieldTemplate } from './templates-v2'

// Create application registry
const applicationRegistry = new Map([
  ['calculator', CalculatorTemplate],
  ['slider', SliderTemplate],
  ['textfield', TextFieldTemplate],
])

export function DesktopDemo() {
  return (
    <NetworkProvider>
      <div className="w-screen h-screen overflow-hidden bg-gray-900">
        <Desktop applicationRegistry={applicationRegistry}>
          {/* Any additional desktop elements can go here */}
          <div className="absolute top-4 left-4 text-white/70 text-sm font-mono">
            <div>Bassline Desktop Environment</div>
            <div className="text-xs mt-1">Click "Apps" in the taskbar to open applications</div>
          </div>
        </Desktop>
      </div>
    </NetworkProvider>
  )
}

// Component to render application content based on template name
export function ApplicationContent({ templateName, appId }: { templateName: string, appId: string }) {
  switch (templateName) {
    case 'calculator':
      return <Calculator appId={appId} />
    
    case 'slider':
      return (
        <div className="p-4">
          <h3 className="text-lg font-semibold mb-4">Slider App</h3>
          <p className="text-gray-600 mb-4">A simple slider application.</p>
          <input
            type="range"
            min="0"
            max="100"
            className="w-full"
          />
          <div className="text-sm text-gray-500 mt-2">
            App ID: {appId}
          </div>
        </div>
      )
    
    case 'textfield':
      return (
        <div className="p-4">
          <h3 className="text-lg font-semibold mb-4">Text Editor</h3>
          <textarea
            className="w-full h-32 p-3 border border-gray-300 rounded resize-none"
            placeholder="Type something..."
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