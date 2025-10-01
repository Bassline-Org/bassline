import type { Route } from "./+types/ui-gallery";
import {
  GadgetProvider,
  Slider,
  Meter,
  Toggle,
  TextInput,
  NumberInput,
  Select,
  Button,
  Checkbox,
  useGadget,
  useGadgetEffect
} from 'port-graphs-react';
import {
  quick,
  withTaps,
  sliderProto,
  meterProto,
  toggleProto,
  textInputProto,
  numberInputProto,
  selectProto,
  buttonProto,
  checkboxProto,
  lastProto,
  counterProto
} from 'port-graphs';

export function meta({ }: Route.MetaArgs) {
  return [
    { title: "UI Gallery - Port Graphs" },
    { name: "description", content: "Complete UI gadget component gallery" },
  ];
}

// Create all our gadgets using NEW proto system
const nameInput = withTaps(quick(textInputProto, { value: '', placeholder: 'Enter your name...' }));
const ageInput = withTaps(quick(numberInputProto, { value: 25, min: 1, max: 120, step: 1 }));
const volumeSlider = withTaps(quick(sliderProto, { value: 50, min: 0, max: 100, step: 1 }));
const volumeMeter = withTaps(quick(meterProto, { value: 50, min: 0, max: 100 }));

// Wire slider and meter together
volumeSlider.tap((effect) => {
  if ('changed' in effect && effect.changed !== undefined) {
    volumeMeter.receive({ display: effect.changed as number });
  }
});

const colorSelect = withTaps(quick(selectProto<string>(), { value: 'Blue', options: ['Red', 'Green', 'Blue', 'Yellow'] }));
const sizeSelect = withTaps(quick(selectProto<string>(), { value: 'Medium', options: ['Small', 'Medium', 'Large'] }));

const submitButton = withTaps(quick(buttonProto, { label: 'Submit Form', disabled: false }));
const resetButton = withTaps(quick(buttonProto, { label: 'Reset', disabled: false }));
const dangerButton = withTaps(quick(buttonProto, { label: 'Delete All', disabled: false }));

const emailCheck = withTaps(quick(checkboxProto, { checked: false, label: 'Subscribe to newsletter' }));
const termsCheck = withTaps(quick(checkboxProto, { checked: false, label: 'I agree to terms and conditions' }));

// Create a cell to collect form data
const defaultFormData = {
  name: '',
  age: 0,
  color: '',
  size: '',
  newsletter: false,
  terms: false,
  volume: 0,
  darkMode: false
}
const formDataCell = withTaps(quick(lastProto(), defaultFormData));

// Counter example
const countDisplay = withTaps(quick(numberInputProto, { value: 0, min: -100, max: 100, step: 1 }));
const incrementBtn = withTaps(quick(buttonProto, { label: '+1', disabled: false }));
const decrementBtn = withTaps(quick(buttonProto, { label: '-1', disabled: false }));
const resetCountBtn = withTaps(quick(buttonProto, { label: 'Reset', disabled: false }));
const darkModeToggle = withTaps(quick(toggleProto, { on: false }));

function UIGalleryInner() {
  const [darkMode, , darkModeGadget] = useGadget(toggleProto, { on: false });
  const [formData, updateFormData, formDataGadget] = useGadget(lastProto(), defaultFormData);
  const [countState, , countDisplayGadget] = useGadget(numberInputProto, { value: 0, min: -100, max: 100, step: 1 });

  useGadgetEffect(formDataGadget, (effects) => {
    if ('changed' in effects && effects.changed !== undefined) {
      console.log('Form data changed:', effects.changed);
    }
  }, [formDataGadget]);

  return (
    <div className={`min-h-screen p-8 ${darkMode?.on ? 'bg-gray-900 text-white' : 'bg-white'}`}>
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">UI Component Gallery</h1>
          <div className="flex items-center gap-2">
            <span>Dark Mode</span>
            <Toggle gadget={darkModeToggle} onChange={(state) => {
              console.log('Dark mode toggled:', state);
              updateFormData({ darkMode: state });
            }} />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Text Inputs Section */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold mb-4">Text & Number Inputs</h2>

            <div>
              <label className="block text-sm font-medium mb-1">Name</label>
              <TextInput gadget={nameInput} className="w-full" onChange={(changed) => {
                updateFormData({ name: changed });
              }} />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Age</label>
              <NumberInput gadget={ageInput} onChange={(changed) => {
                updateFormData({ age: changed });
              }} />
            </div>
          </div>

          {/* Selects Section */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold mb-4">Select Dropdowns</h2>

            <div>
              <label className="block text-sm font-medium mb-1">Favorite Color</label>
              <Select gadget={colorSelect} className="w-full" onChange={(changed) => {
                updateFormData({ color: changed });
              }} />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">T-Shirt Size</label>
              <Select gadget={sizeSelect} className="w-full" onChange={(changed) => {
                updateFormData({ size: changed });
              }} />
            </div>
          </div>

          {/* Sliders & Meters */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold mb-4">Sliders & Meters</h2>

            <div>
              <label className="block text-sm font-medium mb-1">Volume Control</label>
              <Slider gadget={volumeSlider} showValue showLabels onChange={(changed) => {
                updateFormData({ volume: changed });
              }} />
              <Slider gadget={volumeSlider} onChange={(changed) => {
                console.log('Volume changed:', changed);
              }} />
              <Slider gadget={volumeSlider} showLabels onChange={(changed) => {
                console.log('Volume changed from anotha:', changed);
              }} />
              <div className="mt-2">
                <Meter gadget={volumeMeter} showPercentage />
              </div>
            </div>
          </div>

          {/* Checkboxes & Toggles */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold mb-4">Checkboxes & Toggles</h2>

            <Checkbox gadget={emailCheck} onChange={(changed) => {
              updateFormData({ newsletter: changed });
            }} />
            <Checkbox gadget={termsCheck} onChange={(changed) => {
              updateFormData({ terms: changed });
            }} />
          </div>

          {/* Buttons Section */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold mb-4">Buttons</h2>

            <div className="flex gap-2">
              <Button gadget={submitButton} variant="primary" onClick={() => {
                const data = formData;
                console.log('Form submitted:', data);
                alert(`Form submitted! Check console for details.`);
              }} />
              <Button gadget={resetButton} variant="secondary" onClick={() => {
                // Reset all form fields
                nameInput.receive({ set: '' });
                ageInput.receive({ set: 25 });
                colorSelect.receive({ select: 'Blue' });
                sizeSelect.receive({ select: 'Medium' });
                emailCheck.receive({ set: false });
                termsCheck.receive({ set: false });
                volumeSlider.receive({ set: 50 });
              }} />
              <Button gadget={dangerButton} variant="danger" onClick={() => {
                if (confirm('Are you sure you want to delete all data?')) {
                  formDataCell.receive({
                    name: '',
                    age: 0,
                    color: '',
                    size: '',
                    newsletter: false,
                    terms: false
                  });
                }
              }} />
            </div>
          </div>

          {/* Counter Example */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold mb-4">Interactive Counter</h2>

            <div className="flex items-center gap-2">
              <Button gadget={decrementBtn} onClick={() => {
                countDisplay.receive({ decrement: {} })
              }} variant="secondary" />
              <NumberInput gadget={countDisplay} showButtons={false} />
              <Button gadget={incrementBtn} variant="secondary" onClick={() => {
                countDisplay.receive({ increment: {} })
              }} />
              <Button gadget={resetCountBtn} variant="primary" onClick={() => {
                countDisplay.receive({ set: 0 })
              }} />
            </div>
            <p className="text-sm text-gray-600">
              Current count: {countState?.value ?? 0}
            </p>
          </div>
        </div>

        {/* Form Data Display */}
        <div className="mt-8 p-4 bg-gray-100 dark:bg-gray-800 rounded">
          <h3 className="font-semibold mb-2">Form Data (Last Submit):</h3>
          <pre className="text-sm">
            {JSON.stringify(formData, null, 2)}
          </pre>
        </div>

        {/* Info Section */}
        <div className="mt-8 p-4 bg-blue-50 dark:bg-blue-900 rounded">
          <h3 className="font-bold mb-2">About This Gallery</h3>
          <ul className="list-disc ml-6 space-y-1 text-sm">
            <li>Every UI element is a typed gadget with full type inference</li>
            <li>Components use the command pattern for state management</li>
            <li>All gadgets can be wired together using taps and effects</li>
            <li>Form state is collected in a cell gadget</li>
            <li>Counter demonstrates gadget composition</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default function UIGallery() {
  return (
    <GadgetProvider>
      <UIGalleryInner />
    </GadgetProvider>
  );
}