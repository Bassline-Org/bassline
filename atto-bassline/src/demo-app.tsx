/**
 * Demo application showing propagation-powered UI
 * Components participate directly in the propagation network
 */

import React, { useState } from 'react'
import { NetworkProvider, useWiring, useTemplateBuilder, useTemplate, useContact, useGadgetValue } from './react-templates'
import { Button, Slider, TextField, Panel, Toggle, Select } from './react-components'
import { ColorPickerTemplate, RangeSliderTemplate, FormFieldTemplate, PanelTemplate, ToggleTemplate, SelectTemplate } from './ui-templates'
import { SliderTemplate, TextFieldTemplate, Multiply } from './templates-v2'
import { signal, propagate } from './propagation'
import type { Gadget } from './types'

// ============================================================================
// Color Picker Component (composed from templates)
// ============================================================================

function ColorPicker() {
  // Create color sliders as gadgets with stable IDs for persistence
  const redSlider = useTemplate(SliderTemplate, { 
    value: 128, min: 0, max: 255, step: 1 
  }, 'color-red-slider')
  
  const greenSlider = useTemplate(SliderTemplate, { 
    value: 128, min: 0, max: 255, step: 1 
  }, 'color-green-slider')
  
  const blueSlider = useTemplate(SliderTemplate, { 
    value: 128, min: 0, max: 255, step: 1 
  }, 'color-blue-slider')
  
  // Use contacts to get values
  const [red, setRed] = useContact<number>(redSlider.gadget, 'value')
  const [green, setGreen] = useContact<number>(greenSlider.gadget, 'value')
  const [blue, setBlue] = useContact<number>(blueSlider.gadget, 'value')
  
  // Compute the color values directly
  const redVal = Math.floor(red || 0)
  const greenVal = Math.floor(green || 0)
  const blueVal = Math.floor(blue || 0)
  
  const hex = `#${redVal.toString(16).padStart(2, '0')}${greenVal.toString(16).padStart(2, '0')}${blueVal.toString(16).padStart(2, '0')}`
  const rgb = `rgb(${redVal}, ${greenVal}, ${blueVal})`
  
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <h3>Color Picker</h3>
      
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <label style={{ width: '60px' }}>Red:</label>
        <input
          type="range"
          value={red || 0}
          min={0}
          max={255}
          onChange={(e) => setRed(Number(e.target.value))}
          style={{ flex: 1 }}
        />
        <span style={{ minWidth: '40px' }}>{redVal}</span>
      </div>
      
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <label style={{ width: '60px' }}>Green:</label>
        <input
          type="range"
          value={green || 0}
          min={0}
          max={255}
          onChange={(e) => setGreen(Number(e.target.value))}
          style={{ flex: 1 }}
        />
        <span style={{ minWidth: '40px' }}>{greenVal}</span>
      </div>
      
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <label style={{ width: '60px' }}>Blue:</label>
        <input
          type="range"
          value={blue || 0}
          min={0}
          max={255}
          onChange={(e) => setBlue(Number(e.target.value))}
          style={{ flex: 1 }}
        />
        <span style={{ minWidth: '40px' }}>{blueVal}</span>
      </div>
      
      <div 
        style={{
          width: '100%',
          height: '60px',
          background: rgb || 'black',
          border: '1px solid #ccc',
          borderRadius: '4px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontFamily: 'monospace'
        }}
      >
        {hex}
      </div>
    </div>
  )
}

// ============================================================================
// Helper Components for Interactive Panels
// ============================================================================

// These components take a gadget prop and bind to it directly
function VolumeSlider({ gadget }: { gadget: Gadget }) {
  const [value, setValue] = useContact<number>(gadget, 'value')
  
  return (
    <input
      type="range"
      value={value || 0}
      min={0}
      max={100}
      onChange={(e) => setValue(Number(e.target.value))}
      style={{ width: '100%' }}
    />
  )
}

function NameField({ gadget }: { gadget: Gadget }) {
  const [text, setText] = useContact<string>(gadget, 'text')
  
  return (
    <input
      type="text"
      value={text || ''}
      placeholder="Enter name..."
      onChange={(e) => setText(e.target.value)}
      style={{
        padding: '8px',
        borderRadius: '4px',
        border: '1px solid #ccc',
        width: '100%'
      }}
    />
  )
}

function NotificationToggle({ gadget }: { gadget: Gadget }) {
  const [checked, setChecked] = useContact<boolean>(gadget, 'checked')
  const [label] = useContact<string>(gadget, 'label')
  
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
      <input
        type="checkbox"
        checked={checked || false}
        onChange={(e) => setChecked(e.target.checked)}
      />
      {label && <span>{label}</span>}
    </label>
  )
}

function ThemeSelect({ gadget }: { gadget: Gadget }) {
  const [value, setValue] = useContact<string>(gadget, 'value')
  const [options] = useContact<string[]>(gadget, 'options')
  
  return (
    <select
      value={value || ''}
      onChange={(e) => setValue(e.target.value)}
      style={{
        padding: '8px',
        borderRadius: '4px',
        border: '1px solid #ccc',
        background: '#fff',
        cursor: 'pointer',
        width: '100%'
      }}
    >
      <option value="">Select...</option>
      {Array.isArray(options) && options.map((option, i) => (
        <option key={i} value={option}>{option}</option>
      ))}
    </select>
  )
}

// ============================================================================
// Interactive Panels Demo
// ============================================================================

function InteractivePanels() {
  // Create panels as gadgets with stable IDs for automatic persistence
  const controlsPanel = useTemplate(PanelTemplate, { 
    x: 20, y: 20, width: 200, height: 250, title: 'Controls', visible: true 
  }, 'panel-controls')
  
  const settingsPanel = useTemplate(PanelTemplate, { 
    x: 250, y: 20, width: 200, height: 200, title: 'Settings', visible: true 
  }, 'panel-settings')
  
  const outputPanel = useTemplate(PanelTemplate, { 
    x: 480, y: 20, width: 250, height: 150, title: 'Output', visible: true 
  }, 'panel-output')
  
  // Create gadgets for our controls with stable IDs
  const volumeSlider = useTemplate(SliderTemplate, { value: 50, min: 0, max: 100 }, 'panel-volume-slider')
  const nameField = useTemplate(TextFieldTemplate, { text: '', placeholder: 'Enter name...' }, 'panel-name-field')
  const notificationToggle = useTemplate(ToggleTemplate, { checked: false, label: 'Enable notifications' }, 'panel-notification-toggle')
  const themeSelect = useTemplate(SelectTemplate, { value: '', options: ['Light', 'Dark', 'Auto'] }, 'panel-theme-select')
  
  // Use contacts for the control values
  const [sliderValue] = useContact<number>(volumeSlider.gadget, 'value')
  const [textValue] = useContact<string>(nameField.gadget, 'text')
  const [toggleValue] = useContact<boolean>(notificationToggle.gadget, 'checked')
  const [selectValue] = useContact<string>(themeSelect.gadget, 'value')
  
  // Get panel positions from gadgets
  const [controlsX, setControlsX] = useContact<number>(controlsPanel.gadget, 'x')
  const [controlsY, setControlsY] = useContact<number>(controlsPanel.gadget, 'y')
  const [settingsX, setSettingsX] = useContact<number>(settingsPanel.gadget, 'x')
  const [settingsY, setSettingsY] = useContact<number>(settingsPanel.gadget, 'y')
  const [outputX, setOutputX] = useContact<number>(outputPanel.gadget, 'x')
  const [outputY, setOutputY] = useContact<number>(outputPanel.gadget, 'y')
  
  return (
    <div style={{ position: 'relative', width: '100%', height: '600px', background: '#f9f9f9' }}>
      <Panel
        x={controlsX}
        y={controlsY}
        width={200}
        height={250}
        title="Controls"
        onMove={(x, y) => {
          setControlsX(x)
          setControlsY(y)
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <div>
            <label>Volume:</label>
            <VolumeSlider gadget={volumeSlider.gadget} />
          </div>
          
          <div>
            <label>Name:</label>
            <NameField gadget={nameField.gadget} />
          </div>
          
          <Button 
            text="Apply Settings" 
            onClicked={() => console.log('Settings:', { sliderValue, textValue })}
          />
        </div>
      </Panel>
      
      <Panel
        x={settingsX}
        y={settingsY}
        width={200}
        height={200}
        title="Settings"
        onMove={(x, y) => {
          setSettingsX(x)
          setSettingsY(y)
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <NotificationToggle gadget={notificationToggle.gadget} />
          
          <div>
            <label>Theme:</label>
            <ThemeSelect gadget={themeSelect.gadget} />
          </div>
        </div>
      </Panel>
      
      <Panel
        x={outputX}
        y={outputY}
        width={250}
        height={150}
        title="Output"
        onMove={(x, y) => {
          setOutputX(x)
          setOutputY(y)
        }}
      >
        <div style={{ fontSize: '0.9em' }}>
          <p><strong>Current Values:</strong></p>
          <ul style={{ margin: '10px 0', paddingLeft: '20px' }}>
            <li>Volume: {sliderValue}%</li>
            <li>Name: {textValue || '(empty)'}</li>
            <li>Notifications: {toggleValue ? 'On' : 'Off'}</li>
            <li>Theme: {selectValue || 'Not selected'}</li>
          </ul>
        </div>
      </Panel>
    </div>
  )
}

// ============================================================================
// Wired Components Demo
// ============================================================================

function WiredComponentsDemo() {
  // Create gadgets for our sliders with stable IDs for persistence
  const slider1 = useTemplate(SliderTemplate, { value: 25, min: 0, max: 100 }, 'wired-slider-1')
  const slider2 = useTemplate(SliderTemplate, { value: 75, min: 0, max: 100 }, 'wired-slider-2')
  
  // Wire the sliders to show inverse relationship
  // When one goes up, the other goes down
  React.useEffect(() => {
    const contact1 = slider1.gadget.contacts.get('value')
    const contact2 = slider2.gadget.contacts.get('value')
    
    if (contact1 && contact2) {
      // Create a simple inverse relationship
      // We'll manually handle this for now since bidirectional wiring is complex
    }
  }, [slider1.gadget, slider2.gadget])
  
  const [value1, setValue1] = useContact<number>(slider1.gadget, 'value')
  const [value2, setValue2] = useContact<number>(slider2.gadget, 'value')
  
  // Update the inverse slider when one changes
  const handleSlider1Change = (val: number) => {
    setValue1(val)
    setValue2(100 - val) // Inverse relationship
  }
  
  const handleSlider2Change = (val: number) => {
    setValue2(val)
    setValue1(100 - val) // Inverse relationship
  }
  
  const sum = (value1 || 0) + (value2 || 0)
  
  return (
    <div style={{ padding: '20px', background: '#fff', borderRadius: '8px' }}>
      <h3>Wired Sliders (Inverse Relationship)</h3>
      <p style={{ color: '#666', marginBottom: '20px' }}>
        These sliders have an inverse relationship - when one goes up, the other goes down!
      </p>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div>
          <label>Slider 1: {value1 || 0}</label>
          <input
            type="range"
            value={value1 || 0}
            min={0}
            max={100}
            onChange={(e) => handleSlider1Change(Number(e.target.value))}
            style={{ width: '100%' }}
          />
        </div>
        
        <div>
          <label>Slider 2: {value2 || 0}</label>
          <input
            type="range"
            value={value2 || 0}
            min={0}
            max={100}
            onChange={(e) => handleSlider2Change(Number(e.target.value))}
            style={{ width: '100%' }}
          />
        </div>
        
        <div style={{ 
          padding: '10px', 
          background: '#f5f5f5', 
          borderRadius: '4px',
          fontSize: '1.2em',
          fontWeight: 'bold'
        }}>
          Sum: {sum} (always = 100)
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// Template Builder Demo
// ============================================================================

function TemplateBuilderDemo() {
  const builder = useTemplateBuilder()
  const [builtTemplate, setBuiltTemplate] = useState(null)
  
  const handleBuild = () => {
    // Build a simple processing pipeline
    builder.reset()
    builder.addComponent('input', SliderTemplate)
    builder.addComponent('processor', Multiply)
    builder.addComponent('output', TextFieldTemplate)
    
    builder.addConnection('input.value', 'processor.a')
    builder.addConnection('processor.result', 'output.text')
    
    builder.exposeInput('value', 'input.value')
    builder.exposeInput('factor', 'processor.b')
    builder.exposeOutput('result', 'output.text')
    
    const template = builder.build()
    setBuiltTemplate(template)
    console.log('Built template:', template)
  }
  
  return (
    <div style={{ padding: '20px', background: '#fff', borderRadius: '8px' }}>
      <h3>Template Builder</h3>
      <p style={{ color: '#666', marginBottom: '20px' }}>
        Build templates dynamically at runtime
      </p>
      
      <Button text="Build Pipeline Template" onClicked={handleBuild} />
      
      {builtTemplate && (
        <div style={{ marginTop: '20px', padding: '15px', background: '#f5f5f5', borderRadius: '4px' }}>
          <h4>Built Template Structure:</h4>
          <pre style={{ fontSize: '0.8em', overflow: 'auto' }}>
            {JSON.stringify(builtTemplate, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}

// ============================================================================
// Main Demo App
// ============================================================================

export function DemoApp() {
  const [activeDemo, setActiveDemo] = useState('panels')
  
  return (
    <NetworkProvider>
      <div style={{ fontFamily: 'system-ui, sans-serif', padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
        <h1>Atto-Bassline Propagation UI Demo</h1>
        <p style={{ color: '#666', marginBottom: '30px' }}>
          React components that ARE gadgets in the propagation network
        </p>
        
        <div style={{ display: 'flex', gap: '10px', marginBottom: '30px' }}>
          <Button 
            text="Interactive Panels" 
            onClicked={() => setActiveDemo('panels')}
            style={{ background: activeDemo === 'panels' ? '#007bff' : '#fff', color: activeDemo === 'panels' ? '#fff' : '#000' }}
          />
          <Button 
            text="Color Picker" 
            onClicked={() => setActiveDemo('color')}
            style={{ background: activeDemo === 'color' ? '#007bff' : '#fff', color: activeDemo === 'color' ? '#fff' : '#000' }}
          />
          <Button 
            text="Wired Components" 
            onClicked={() => setActiveDemo('wired')}
            style={{ background: activeDemo === 'wired' ? '#007bff' : '#fff', color: activeDemo === 'wired' ? '#fff' : '#000' }}
          />
          <Button 
            text="Template Builder" 
            onClicked={() => setActiveDemo('builder')}
            style={{ background: activeDemo === 'builder' ? '#007bff' : '#fff', color: activeDemo === 'builder' ? '#fff' : '#000' }}
          />
        </div>
        
        <div style={{ minHeight: '500px' }}>
          {activeDemo === 'panels' && <InteractivePanels />}
          {activeDemo === 'color' && (
            <div style={{ padding: '20px', background: '#fff', borderRadius: '8px', maxWidth: '400px' }}>
              <ColorPicker />
            </div>
          )}
          {activeDemo === 'wired' && <WiredComponentsDemo />}
          {activeDemo === 'builder' && <TemplateBuilderDemo />}
        </div>
      </div>
    </NetworkProvider>
  )
}