/**
 * Main export for React integration with propagation networks
 */

// React hooks and context
export {
  NetworkProvider,
  useTemplate,
  useContact,
  useWiring,
  useGadgetValue,
  useGadgetState,
  useLiveTemplate,
  useTemplateBuilder
} from './react-templates'

// UI Components that are gadgets
export {
  Button,
  Slider,
  TextField,
  Panel,
  Toggle,
  Select
} from './react-components'

// UI Templates
export {
  ButtonTemplate,
  SliderTemplate,
  TextFieldTemplate,
  PanelTemplate,
  ToggleTemplate,
  SelectTemplate,
  ColorPickerTemplate,
  RangeSliderTemplate,
  FormFieldTemplate
} from './ui-templates'

// Demo application
export { DemoApp } from './demo-app'