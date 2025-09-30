import { protoGadget } from '../../core/context';
import {
  sliderStep,
  meterStep,
  toggleStep,
  buttonStep,
  checkboxStep,
  textInputStep,
  numberInputStep,
  selectStep,
  type SliderState,
  type MeterState,
  type ToggleState,
  type ButtonState,
  type CheckboxState,
  type TextInputState,
  type NumberInputState,
  type SelectState
} from './steps';
import { uiHandler } from './handlers';

// ================================================
// UI Proto-Gadgets
// ================================================

export const sliderProto = protoGadget(sliderStep).handler(uiHandler());
export const meterProto = protoGadget(meterStep).handler(uiHandler());
export const toggleProto = protoGadget(toggleStep).handler(uiHandler());
export const buttonProto = protoGadget(buttonStep).handler(uiHandler());
export const checkboxProto = protoGadget(checkboxStep).handler(uiHandler());
export const textInputProto = protoGadget(textInputStep).handler(uiHandler());
export const numberInputProto = protoGadget(numberInputStep).handler(uiHandler());
export const selectProto = <T>() => protoGadget(selectStep<T>()).handler(uiHandler());