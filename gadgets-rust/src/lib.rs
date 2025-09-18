// Minimal gadget protocol implementation in Rust
// Using only std library, no external dependencies

use std::any::Any;
use std::collections::HashMap;
use std::rc::Rc;
use std::cell::RefCell;

/// Core effect types that gadgets can emit
#[derive(Debug)]
pub enum Effect {
    Changed(String), // Use String for simplicity instead of Any
    Noop,
    Custom(String, String),
}

impl Clone for Effect {
    fn clone(&self) -> Self {
        match self {
            Effect::Changed(s) => Effect::Changed(s.clone()),
            Effect::Noop => Effect::Noop,
            Effect::Custom(k, v) => Effect::Custom(k.clone(), v.clone()),
        }
    }
}

/// Core gadget trait - the fundamental protocol
pub trait Gadget {
    type State: Clone;
    type Incoming;

    fn current(&self) -> Self::State;
    fn update(&mut self, state: Self::State);
    fn receive(&mut self, data: Self::Incoming);
    fn emit(&mut self, effect: Effect);
}

/// Consider result - what action to take
pub enum ConsiderResult {
    Action(String),
    Nothing,
}

/// Semantic extension - can modify gadget behavior
pub trait SemanticExtension {
    fn wrap_emit(&self, effect: Effect) -> Effect {
        effect
    }

    fn wrap_receive(&self, data: Box<dyn Any>) -> Box<dyn Any> {
        data
    }
}

/// Tapping extension - allows multiple observers
pub struct TappingExtension {
    taps: Rc<RefCell<Vec<Box<dyn FnMut(Effect)>>>>,
}

impl TappingExtension {
    pub fn new() -> Self {
        Self {
            taps: Rc::new(RefCell::new(Vec::new())),
        }
    }

    pub fn tap<F>(&self, f: F) -> TapHandle
    where
        F: FnMut(Effect) + 'static,
    {
        let mut taps = self.taps.borrow_mut();
        let id = taps.len();
        taps.push(Box::new(f));
        TapHandle {
            id,
            taps: Rc::clone(&self.taps),
        }
    }
}

pub struct TapHandle {
    id: usize,
    taps: Rc<RefCell<Vec<Box<dyn FnMut(Effect)>>>>,
}

impl Drop for TapHandle {
    fn drop(&mut self) {
        // In production, would track and remove specific tap
        // For simplicity, we're not implementing removal
    }
}

impl SemanticExtension for TappingExtension {
    fn wrap_emit(&self, effect: Effect) -> Effect {
        let mut taps = self.taps.borrow_mut();
        for tap in taps.iter_mut() {
            tap(effect.clone());
        }
        effect
    }
}

/// A basic gadget implementation with consider/act pattern
pub struct BasicGadget<S, I> {
    state: S,
    consider: Box<dyn Fn(&S, &I) -> ConsiderResult>,
    actions: HashMap<String, Box<dyn Fn(&mut S, &I) -> Effect>>,
    extensions: Vec<Box<dyn SemanticExtension>>,
}

impl<S: Clone, I> BasicGadget<S, I> {
    pub fn new(
        initial: S,
        consider: Box<dyn Fn(&S, &I) -> ConsiderResult>,
        actions: HashMap<String, Box<dyn Fn(&mut S, &I) -> Effect>>,
    ) -> Self {
        Self {
            state: initial,
            consider,
            actions,
            extensions: Vec::new(),
        }
    }

    pub fn add_extension(&mut self, ext: Box<dyn SemanticExtension>) {
        self.extensions.push(ext);
    }
}

impl<S: Clone, I> Gadget for BasicGadget<S, I> {
    type State = S;
    type Incoming = I;

    fn current(&self) -> S {
        self.state.clone()
    }

    fn update(&mut self, state: S) {
        self.state = state;
    }

    fn receive(&mut self, data: I) {
        let result = (self.consider)(&self.state, &data);

        match result {
            ConsiderResult::Action(action_name) => {
                if let Some(action) = self.actions.get(&action_name) {
                    let effect = action(&mut self.state, &data);
                    self.emit(effect);
                }
            }
            ConsiderResult::Nothing => {}
        }
    }

    fn emit(&mut self, effect: Effect) {
        let mut final_effect = effect;
        for ext in &self.extensions {
            final_effect = ext.wrap_emit(final_effect);
        }
        // In real implementation, would send to external system
        println!("Emitted: {:?}", final_effect);
    }
}

/// Example: MaxCell gadget
pub struct MaxCell {
    value: i32,
}

impl MaxCell {
    pub fn new(initial: i32) -> Self {
        Self {
            value: initial,
        }
    }
}

impl Gadget for MaxCell {
    type State = i32;
    type Incoming = i32;

    fn current(&self) -> i32 {
        self.value
    }

    fn update(&mut self, state: i32) {
        self.value = state;
    }

    fn receive(&mut self, data: i32) {
        if data > self.value {
            self.value = data;
            self.emit(Effect::Changed(data.to_string()));
        } else {
            self.emit(Effect::Noop);
        }
    }

    fn emit(&mut self, effect: Effect) {
        println!("MaxCell emitted: {:?}", effect);
    }
}

/// Example: Counter gadget
pub struct Counter {
    count: i32,
}

impl Counter {
    pub fn new() -> Self {
        Self { count: 0 }
    }
}

impl Gadget for Counter {
    type State = i32;
    type Incoming = String;

    fn current(&self) -> i32 {
        self.count
    }

    fn update(&mut self, state: i32) {
        self.count = state;
    }

    fn receive(&mut self, data: String) {
        match data.as_str() {
            "increment" => {
                self.count += 1;
                self.emit(Effect::Changed(self.count.to_string()));
            }
            "decrement" => {
                self.count -= 1;
                self.emit(Effect::Changed(self.count.to_string()));
            }
            "reset" => {
                self.count = 0;
                self.emit(Effect::Changed(self.count.to_string()));
            }
            _ => {
                self.emit(Effect::Noop);
            }
        }
    }

    fn emit(&mut self, effect: Effect) {
        println!("Counter emitted: {:?}", effect);
    }
}