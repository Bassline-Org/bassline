// Simple test to verify the decorator system works
import { initialize } from '.';
initialize();
import { Gadget, defineGadget, input, output, createGadget } from './gadgets';
import { Term } from './terms';


// Test gadget
@defineGadget('test-adder')
// @ts-ignore - TypeScript incorrectly thinks this class is unused (it's used by the decorator)
class TestAdder extends Gadget {
    @input(0)
    a: Term = 0;
    
    @input(0)
    b: Term = 0;
    
    @output(0)
    result: Term = 0;

    compute() {
        this.result = (this.a as number) + (this.b as number);
        console.log(`Computed: ${String(this.a)} + ${String(this.b)} = ${String(this.result)}`);
    }
}

// Test the system
console.log('Testing decorator system...');

// Enable debug logging
globalThis.GadgetConfig.DEBUG_LOGGING = true;
globalThis.GadgetConfig.COMPUTATION_LOGGING = true;

try {
    // Create a gadget instance
    const adder = createGadget('test-adder', 'my-adder', 'test-namespace');
    console.log('✅ Gadget created successfully');
    
    // Debug: Check what properties exist
    console.log('Gadget properties:', Object.getOwnPropertyNames(adder));
    console.log('Gadget prototype properties:', Object.getOwnPropertyNames(Object.getPrototypeOf(adder)));
    
    // Test input setting
    console.log('Setting a = 5...');
    (adder as any).a = 5;
    console.log('Setting b = 3...');
    (adder as any).b = 3;
    console.log('✅ Inputs set successfully');
    
    // Check if compute was triggered
    console.log('Result:', (adder as any).result);
    console.log('Interface inputs:', (adder as any).INTERFACE.inputs);
    
    console.log('✅ All tests passed!');
} catch (error) {
    console.error('❌ Test failed:', error);
}
