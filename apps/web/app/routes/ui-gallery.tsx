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
import { lastCell } from 'port-graphs/cells';

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

const colorSelect = selectGadget(['Red', 'Green', 'Blue', 'Yellow'], 'Blue');
const sizeSelect = selectGadget(['Small', 'Medium', 'Large'], 'Medium');

const submitButton = buttonGadget('Submit Form');
const resetButton = buttonGadget('Reset');
const dangerButton = buttonGadget('Delete All');

const emailCheck = checkboxGadget(false, 'Subscribe to newsletter');
const termsCheck = checkboxGadget(false, 'I agree to terms and conditions');
const darkModeToggle = toggleGadget(false);

// Create a cell to collect form data
const formDataCell = withTaps(lastCell<any>({}));

// Counter example
const countDisplay = withTaps(numberInputGadget(0, -100, 100, 1));
const incrementBtn = buttonGadget('+1');
const decrementBtn = buttonGadget('-1');
const resetCountBtn = buttonGadget('Reset');

function UIGalleryInner() {
  const [formData] = useGadget(formDataCell);
  const [nameState] = useGadget(nameInput);
  const [ageState] = useGadget(ageInput);
  const [colorState] = useGadget(colorSelect);
  const [sizeState] = useGadget(sizeSelect);
  const [emailState] = useGadget(emailCheck);
  const [termsState] = useGadget(termsCheck);
  const [darkMode] = useGadget(darkModeToggle);
  const [countState] = useGadget(countDisplay);

  // Wire volume slider to meter
  useGadgetEffect(volumeSlider, ({ changed }) => {
    if (changed) {
      volumeMeter.receive({ display: changed });
    }
  }, []);

  // Wire counter buttons
  useGadgetEffect(incrementBtn, ({ clicked }) => {
    if (clicked) {
      countDisplay.receive({ increment: {} });
    }
  }, []);

  useGadgetEffect(decrementBtn, ({ clicked }) => {
    if (clicked) {
      countDisplay.receive({ decrement: {} });
    }
  }, []);

  useGadgetEffect(resetCountBtn, ({ clicked }) => {
    if (clicked) {
      countDisplay.receive({ set: 0 });
    }
  }, []);

  // Collect form data
  useGadgetEffect(submitButton, ({ clicked }) => {
    if (clicked) {
      const data = {
        name: nameState?.value,
        age: ageState?.value,
        color: colorState?.value,
        size: sizeState?.value,
        newsletter: emailState?.checked,
        terms: termsState?.checked
      };
      formDataCell.receive(data);
      console.log('Form submitted:', data);
    }
  }, [nameState, ageState, colorState, sizeState, emailState, termsState]);

  // Reset form
  useGadgetEffect(resetButton, ({ clicked }) => {
    if (clicked) {
      nameInput.receive({ clear: {} });
      ageInput.receive({ set: 25 });
      colorSelect.receive({ select: 'Blue' });
      sizeSelect.receive({ select: 'Medium' });
      emailCheck.receive({ uncheck: {} });
      termsCheck.receive({ uncheck: {} });
      formDataCell.receive({});
    }
  }, []);

  return (
    <div className={`min-h-screen p-8 ${darkMode?.value ? 'bg-gray-900 text-white' : 'bg-white'}`}>
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
              <TextInput gadget={nameInput} className="w-full" />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Age</label>
              <NumberInput gadget={ageInput} />
            </div>
          </div>

          {/* Selects Section */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold mb-4">Select Dropdowns</h2>

            <div>
              <label className="block text-sm font-medium mb-1">Favorite Color</label>
              <Select gadget={colorSelect} className="w-full" />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">T-Shirt Size</label>
              <Select gadget={sizeSelect} className="w-full" />
            </div>
          </div>

          {/* Sliders & Meters */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold mb-4">Sliders & Meters</h2>

            <div>
              <label className="block text-sm font-medium mb-1">Volume Control</label>
              <Slider gadget={volumeSlider} showValue showLabels />
              <div className="mt-2">
                <Meter gadget={volumeMeter} showPercentage />
              </div>
            </div>
          </div>

          {/* Checkboxes & Toggles */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold mb-4">Checkboxes & Toggles</h2>

            <Checkbox gadget={emailCheck} />
            <Checkbox gadget={termsCheck} />
          </div>

          {/* Buttons Section */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold mb-4">Buttons</h2>

            <div className="flex gap-2">
              <Button gadget={submitButton} variant="primary" />
              <Button gadget={resetButton} variant="secondary" />
              <Button gadget={dangerButton} variant="danger" />
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