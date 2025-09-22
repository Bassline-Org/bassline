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
  sliderGadget,
  meterGadget,
  toggleGadget,
  textInputGadget,
  numberInputGadget,
  selectGadget,
  buttonGadget,
  checkboxGadget,
  withTaps,
} from 'port-graphs';
import { lastMap } from 'port-graphs/cells';

export function meta({ }: Route.MetaArgs) {
  return [
    { title: "UI Gallery - Port Graphs" },
    { name: "description", content: "Complete UI gadget component gallery" },
  ];
}

// Create all our gadgets
const nameInput = textInputGadget('', 'Enter your name...');
const ageInput = numberInputGadget(25, 1, 120, 1);
const volumeSlider = sliderGadget(50, 0, 100, 1);
const volumeMeter = meterGadget(0, 100);

// Wire slider to meter
volumeSlider.tap((effect) => {
  if ('changed' in effect) {
    volumeMeter.receive({ display: effect.changed });
  }
});

const colorSelect = selectGadget(['Red', 'Green', 'Blue', 'Yellow'], 'Blue');
const sizeSelect = selectGadget(['Small', 'Medium', 'Large'], 'Medium');

const submitButton = buttonGadget('Submit Form');
const resetButton = buttonGadget('Reset');
const dangerButton = buttonGadget('Delete All');

const emailCheck = checkboxGadget(false, 'Subscribe to newsletter');
const termsCheck = checkboxGadget(false, 'I agree to terms and conditions');
const darkModeToggle = toggleGadget(false);

// Create a cell to collect form data
const formDataCell = withTaps(lastMap({
  name: '',
  age: 0,
  color: '',
  size: '',
  newsletter: false,
  terms: false
}));

// Counter example
const countDisplay = numberInputGadget(0, -100, 100, 1);
const incrementBtn = buttonGadget('+1');
const decrementBtn = buttonGadget('-1');
const resetCountBtn = buttonGadget('Reset');

function UIGalleryInner() {
  const [darkMode] = useGadget(darkModeToggle);
  const [formData] = useGadget(formDataCell);
  const [countState] = useGadget(countDisplay);

  useGadgetEffect(formDataCell, ({ changed }) => {
    console.log('Form data changed:', changed);
  }, [formDataCell]);

  return (
    <div className={`min-h-screen p-8 ${darkMode?.on ? 'bg-gray-900 text-white' : 'bg-white'}`}>
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">UI Component Gallery</h1>
          <div className="flex items-center gap-2">
            <span>Dark Mode</span>
            <Toggle gadget={darkModeToggle} />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Text Inputs Section */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold mb-4">Text & Number Inputs</h2>

            <div>
              <label className="block text-sm font-medium mb-1">Name</label>
              <TextInput gadget={nameInput} className="w-full" onChange={(changed) => {
                formDataCell.receive({ name: changed });
              }} />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Age</label>
              <NumberInput gadget={ageInput} onChange={(changed) => {
                formDataCell.receive({ age: changed });
              }} />
            </div>
          </div>

          {/* Selects Section */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold mb-4">Select Dropdowns</h2>

            <div>
              <label className="block text-sm font-medium mb-1">Favorite Color</label>
              <Select gadget={colorSelect} className="w-full" onChange={(changed) => {
                formDataCell.receive({ color: changed });
              }} />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">T-Shirt Size</label>
              <Select gadget={sizeSelect} className="w-full" onChange={(changed) => {
                formDataCell.receive({ size: changed });
              }} />
            </div>
          </div>

          {/* Sliders & Meters */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold mb-4">Sliders & Meters</h2>

            <div>
              <label className="block text-sm font-medium mb-1">Volume Control</label>
              <Slider gadget={volumeSlider} showValue showLabels onChange={(changed) => {
                formDataCell.receive({ volume: changed });
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
              formDataCell.receive({ newsletter: changed });
            }} />
            <Checkbox gadget={termsCheck} onChange={(changed) => {
              formDataCell.receive({ terms: changed });
            }} />
          </div>

          {/* Buttons Section */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold mb-4">Buttons</h2>

            <div className="flex gap-2">
              <Button gadget={resetButton} variant="secondary" onClick={(changed) => {
                console.log('Reset button clicked');
              }} />
              <Button gadget={dangerButton} variant="danger" onClick={(changed) => {
                console.log('Danger button clicked');
              }} />
            </div>
          </div>

          {/* Counter Example */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold mb-4">Interactive Counter</h2>

            <div className="flex items-center gap-2">
              <Button gadget={decrementBtn} variant="secondary" />
              <NumberInput gadget={countDisplay} showButtons={false} />
              <Button gadget={incrementBtn} variant="secondary" />
              <Button gadget={resetCountBtn} variant="primary" />
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