#!/usr/bin/env tsx
/**
 * Test simplified compilation pipeline: Parser → Validator → Compiler → Materializer
 */

import { createChoreographyParser } from './src/compilation/gadgets/parser-functional';
import { createSemanticValidator } from './src/compilation/gadgets/validator-functional';
import { createFilesystemCompiler } from './src/compilation/targets/filesystem-functional';
import { createFileMaterializer } from './src/compilation/gadgets/materializer-functional';

console.log('Testing simplified compilation pipeline...\n');

// Create gadgets
const parser = createChoreographyParser();
const validator = createSemanticValidator();
const compiler = createFilesystemCompiler({ outputPath: './test-output' });
const materializer = createFileMaterializer({
  outputPath: './test-output',
  dryRun: true  // Dry run for testing
});

// Track effects
let parserEffects = 0;
let validatorEffects = 0;
let compilerEffects = 0;
let materializerEffects = 0;

// Wire gadgets together
const originalParserEmit = parser.emit.bind(parser);
parser.emit = (effect: any) => {
  parserEffects++;
  console.log(`[Parser] Effect ${parserEffects}:`, effect);
  originalParserEmit(effect);

  // Forward to validator AND compiler (compiler needs AST updates)
  validator.receive(effect);
  compiler.receive(effect);
};

const originalValidatorEmit = validator.emit.bind(validator);
validator.emit = (effect: any) => {
  validatorEffects++;
  console.log(`[Validator] Effect ${validatorEffects}:`, effect);
  originalValidatorEmit(effect);

  // Forward validation results to compiler with slight delay
  // to ensure AST updates are processed first
  if ('validationResult' in effect) {
    setTimeout(() => compiler.receive(effect), 10);
  }
};

const originalCompilerEmit = compiler.emit.bind(compiler);
compiler.emit = (effect: any) => {
  compilerEffects++;
  console.log(`[Compiler] Effect ${compilerEffects}:`, effect);
  originalCompilerEmit(effect);

  // Forward materialization requests to materializer
  if ('materialization' in effect) {
    materializer.receive(effect);
  }
};

const originalMaterializerEmit = materializer.emit.bind(materializer);
materializer.emit = (effect: any) => {
  materializerEffects++;
  console.log(`[Materializer] Effect ${materializerEffects}:`, effect);
  originalMaterializerEmit(effect);
};

// Test choreography
const testChoreography = `
name: test-compilation
roles:
  api:
    type: coordinator
    capabilities: [receive, emit, coordinate]
  worker:
    type: processor
    capabilities: [process, emit]
relationships:
  api -> worker: http
`;

console.log('Input choreography:');
console.log(testChoreography);
console.log('\n--- Starting compilation ---\n');

// Start compilation
parser.receive({
  source: testChoreography,
  path: 'test.yaml',
  format: 'yaml'
});

// Give gadgets time to process
setTimeout(() => {
  console.log('\n--- Final Summary ---');
  console.log(`Parser emitted: ${parserEffects} effects`);
  console.log(`Validator emitted: ${validatorEffects} effects`);
  console.log(`Compiler emitted: ${compilerEffects} effects`);
  console.log(`Materializer emitted: ${materializerEffects} effects`);

  console.log('\n--- Final States ---');
  const compilerState = compiler.current();
  console.log('Compiler AST nodes:', compilerState.ast.roles.size, 'roles,', compilerState.ast.relationships.size, 'relationships');
  console.log('Compiler generated artifacts:', compilerState.generatedArtifacts.size);

  const materializerState = materializer.current();
  console.log('Materializer files:', materializerState.materializedFiles.size);
}, 200);