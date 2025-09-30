import {
    run,
    maxStep,
    contramapInput,
    mapOutput
} from "./transduce";

// Test basic usage
console.log("=== Basic Usage ===");

const max = gadget(maxStep, 0);
const runMax = run(max);

runMax(5);   // merges 5
runMax(3);   // ignores (3 < 5)
runMax(10);  // merges 10

console.log("Current max:", max.source());

// Test input transformation
console.log("\n=== Input Transformation ===");

const celsiusMax = contramapInput(
    (c: number) => (c * 9 / 5) + 32,
    maxStep
);

const temp = gadget(celsiusMax, 32);
const runTemp = run(temp);

runTemp(20);  // 68°F
runTemp(0);   // 32°F (ignored)
runTemp(30);  // 86°F

console.log("Current max (°F):", temp.source());

// Test output transformation
console.log("\n=== Output Transformation ===");

const loggedMax = mapOutput(
    maxStep,
    effect => {
        console.log(effect.kind === 'merge' ? `New max: ${effect.data}` : 'Ignored');
        return effect;
    }
);

const logged = gadget(loggedMax, 0);
const runLogged = run(logged);

runLogged(5);
runLogged(3);
runLogged(8);