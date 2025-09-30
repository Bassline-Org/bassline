// ================================================
// UI Gadget Steps
// ================================================

// Helper function
const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

// ================================================
// Slider
// ================================================

export type SliderState = { value: number; min: number; max: number; step: number };
export type SliderInput =
  | { set: number }
  | { increment: {} }
  | { decrement: {} }
  | { configure: { min?: number; max?: number; step?: number } };

export const sliderStep = (state: SliderState, input: SliderInput) => {
  if ('set' in input) {
    const clamped = clamp(input.set, state.min, state.max);
    const rounded = Math.round(clamped / state.step) * state.step;
    if (rounded !== state.value) {
      return { merge: { ...state, value: rounded }, changed: rounded } as const;
    }
    return { ignore: {} } as const;
  }
  if ('increment' in input) {
    const next = Math.min(state.value + state.step, state.max);
    if (next !== state.value) {
      return { merge: { ...state, value: next }, changed: next } as const;
    }
    return { ignore: {} } as const;
  }
  if ('decrement' in input) {
    const next = Math.max(state.value - state.step, state.min);
    if (next !== state.value) {
      return { merge: { ...state, value: next }, changed: next } as const;
    }
    return { ignore: {} } as const;
  }
  if ('configure' in input) {
    const newState = {
      ...state,
      min: input.configure.min ?? state.min,
      max: input.configure.max ?? state.max,
      step: input.configure.step ?? state.step,
    };
    newState.value = clamp(state.value, newState.min, newState.max);
    return newState.value !== state.value
      ? { merge: newState, changed: newState.value, configured: newState } as const
      : { merge: newState, configured: newState } as const;
  }
  return { ignore: {} } as const;
};

// ================================================
// Meter
// ================================================

export type MeterState = { value: number; min: number; max: number; label?: string };
export type MeterInput =
  | { display: number }
  | { configure: { min?: number; max?: number; label?: string } }
  | { reset: {} };

export const meterStep = (state: MeterState, input: MeterInput) => {
  if ('display' in input) {
    const clamped = clamp(input.display, state.min, state.max);
    if (clamped !== state.value) {
      return { merge: { ...state, value: clamped }, changed: clamped } as const;
    }
    return { ignore: {} } as const;
  }
  if ('configure' in input) {
    const newState = {
      ...state,
      min: input.configure.min ?? state.min,
      max: input.configure.max ?? state.max,
      label: input.configure.label ?? state.label,
    };
    newState.value = clamp(state.value, newState.min, newState.max);
    return { merge: newState, configured: newState } as const;
  }
  if ('reset' in input) {
    if (state.value !== state.min) {
      return { merge: { ...state, value: state.min }, changed: state.min } as const;
    }
    return { ignore: {} } as const;
  }
  return { ignore: {} } as const;
};

// ================================================
// Toggle
// ================================================

export type ToggleState = { on: boolean; label?: string };
export type ToggleInput =
  | { toggle: {} }
  | { set: boolean }
  | { configure: { label?: string } };

export const toggleStep = (state: ToggleState, input: ToggleInput) => {
  if ('toggle' in input) {
    const newState = { ...state, on: !state.on };
    return { merge: newState, changed: newState, toggled: newState.on } as const;
  }
  if ('set' in input) {
    if (input.set !== state.on) {
      const newState = { ...state, on: input.set };
      return { merge: newState, changed: newState, toggled: input.set } as const;
    }
    return { ignore: {} } as const;
  }
  if ('configure' in input) {
    const newState = { ...state, label: input.configure.label ?? state.label };
    return { merge: newState, configured: newState } as const;
  }
  return { ignore: {} } as const;
};

// ================================================
// Button
// ================================================

export type ButtonState = { label: string; disabled: boolean };
export type ButtonInput =
  | { click: {} }
  | { configure: { label?: string; disabled?: boolean } };

export const buttonStep = (state: ButtonState, input: ButtonInput) => {
  if ('click' in input) {
    if (state.disabled) return { ignore: {} } as const;
    return { clicked: {} } as const;
  }
  if ('configure' in input) {
    const newState = {
      label: input.configure.label ?? state.label,
      disabled: input.configure.disabled ?? state.disabled,
    };
    return { merge: newState, configured: newState } as const;
  }
  return { ignore: {} } as const;
};

// ================================================
// Checkbox
// ================================================

export type CheckboxState = { checked: boolean; label?: string };
export type CheckboxInput =
  | { toggle: {} }
  | { set: boolean }
  | { configure: { label?: string } };

export const checkboxStep = (state: CheckboxState, input: CheckboxInput) => {
  if ('toggle' in input) {
    const newState = { ...state, checked: !state.checked };
    return { merge: newState, changed: newState.checked } as const;
  }
  if ('set' in input) {
    if (input.set !== state.checked) {
      const newState = { ...state, checked: input.set };
      return { merge: newState, changed: input.set } as const;
    }
    return { ignore: {} } as const;
  }
  if ('configure' in input) {
    const newState = { ...state, label: input.configure.label ?? state.label };
    return { merge: newState, configured: newState } as const;
  }
  return { ignore: {} } as const;
};

// ================================================
// TextInput
// ================================================

export type TextInputState = { value: string; placeholder?: string };
export type TextInputInput =
  | { set: string }
  | { clear: {} }
  | { configure: { placeholder?: string } };

export const textInputStep = (state: TextInputState, input: TextInputInput) => {
  if ('set' in input) {
    if (input.set !== state.value) {
      return { merge: { ...state, value: input.set }, changed: input.set } as const;
    }
    return { ignore: {} } as const;
  }
  if ('clear' in input) {
    if (state.value !== '') {
      return { merge: { ...state, value: '' }, changed: '', cleared: {} } as const;
    }
    return { ignore: {} } as const;
  }
  if ('configure' in input) {
    const newState = {
      ...state,
      placeholder: input.configure.placeholder ?? state.placeholder,
    };
    return { merge: newState, configured: newState } as const;
  }
  return { ignore: {} } as const;
};

// ================================================
// NumberInput
// ================================================

export type NumberInputState = { value: number; min?: number; max?: number; step?: number };
export type NumberInputInput =
  | { set: number }
  | { increment: {} }
  | { decrement: {} }
  | { configure: { min?: number; max?: number; step?: number } };

export const numberInputStep = (state: NumberInputState, input: NumberInputInput) => {
  const clampValue = (v: number) => {
    let clamped = v;
    if (state.min !== undefined) clamped = Math.max(clamped, state.min);
    if (state.max !== undefined) clamped = Math.min(clamped, state.max);
    return clamped;
  };

  if ('set' in input) {
    const clamped = clampValue(input.set);
    if (clamped !== state.value) {
      return { merge: { ...state, value: clamped }, changed: clamped } as const;
    }
    return { ignore: {} } as const;
  }
  if ('increment' in input) {
    const step = state.step ?? 1;
    const next = clampValue(state.value + step);
    if (next !== state.value) {
      return { merge: { ...state, value: next }, changed: next } as const;
    }
    return { ignore: {} } as const;
  }
  if ('decrement' in input) {
    const step = state.step ?? 1;
    const next = clampValue(state.value - step);
    if (next !== state.value) {
      return { merge: { ...state, value: next }, changed: next } as const;
    }
    return { ignore: {} } as const;
  }
  if ('configure' in input) {
    const newState = {
      ...state,
      min: input.configure.min ?? state.min,
      max: input.configure.max ?? state.max,
      step: input.configure.step ?? state.step,
    };
    newState.value = clampValue(state.value);
    return { merge: newState, configured: newState } as const;
  }
  return { ignore: {} } as const;
};

// ================================================
// Select
// ================================================

export type SelectState<T> = { value: T; options: T[] };
export type SelectInput<T> =
  | { select: T }
  | { configure: { options?: T[] } };

export const selectStep = <T>() => (state: SelectState<T>, input: SelectInput<T>) => {
  if ('select' in input) {
    if (state.options.includes(input.select) && input.select !== state.value) {
      return { merge: { ...state, value: input.select }, changed: input.select } as const;
    }
    return { ignore: {} } as const;
  }
  if ('configure' in input) {
    const newState = {
      ...state,
      options: input.configure.options ?? state.options,
    };
    // Ensure current value is still valid
    if (!newState.options.includes(state.value) && newState.options.length > 0) {
      newState.value = newState.options[0] as T;
      return { merge: newState, changed: newState.value, configured: newState } as const;
    }
    return { merge: newState, configured: newState } as const;
  }
  return { ignore: {} } as const;
};