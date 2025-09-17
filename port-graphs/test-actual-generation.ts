#!/usr/bin/env tsx
/**
 * Test actual file generation with the functional compilation pipeline
 */

import { createChoreographyParser } from './src/compilation/gadgets/parser-functional';
import { createSemanticValidator } from './src/compilation/gadgets/validator-functional';
import { createFilesystemCompiler } from './src/compilation/targets/filesystem-functional';
import { createFileMaterializer } from './src/compilation/gadgets/materializer-functional';
import * as fs from 'fs';
import * as path from 'path';

console.log('Testing actual file generation...\n');

// Clean up previous test output
const outputDir = './test-output-actual';
if (fs.existsSync(outputDir)) {
  fs.rmSync(outputDir, { recursive: true });
}

// Create gadgets
const parser = createChoreographyParser();
const validator = createSemanticValidator();
const compiler = createFilesystemCompiler({ outputPath: outputDir });
const materializer = createFileMaterializer({
  outputPath: outputDir,
  dryRun: false  // Actually write files!
});

// Wire gadgets together
const originalParserEmit = parser.emit.bind(parser);
parser.emit = (effect: any) => {
  originalParserEmit(effect);
  // Forward to validator AND compiler
  validator.receive(effect);
  compiler.receive(effect);
};

const originalValidatorEmit = validator.emit.bind(validator);
validator.emit = (effect: any) => {
  originalValidatorEmit(effect);
  // Forward validation results to compiler with delay
  if ('validationResult' in effect) {
    setTimeout(() => compiler.receive(effect), 10);
  }
};

const originalCompilerEmit = compiler.emit.bind(compiler);
compiler.emit = (effect: any) => {
  originalCompilerEmit(effect);
  // Forward materialization requests to materializer
  if ('materialization' in effect) {
    materializer.receive(effect);
  }
};

// Test choreography
const testChoreography = `
name: test-generation
roles:
  coordinator:
    type: coordinator
    capabilities: [receive, emit, coordinate]
  worker1:
    type: processor
    capabilities: [process, transform, emit]
  worker2:
    type: processor
    capabilities: [process, transform, emit]
relationships:
  coordinator -> worker1: http
  coordinator -> worker2: http
  worker1 -> worker2: tcp
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

// Give gadgets time to process and generate files
setTimeout(() => {
  console.log('\n--- Generated Files ---');

  function listFiles(dir: string, indent = '') {
    if (!fs.existsSync(dir)) {
      console.log(indent + '(directory does not exist)');
      return;
    }

    const items = fs.readdirSync(dir);
    items.forEach(item => {
      const fullPath = path.join(dir, item);
      const stats = fs.statSync(fullPath);

      if (stats.isDirectory()) {
        console.log(indent + item + '/');
        listFiles(fullPath, indent + '  ');
      } else {
        const perms = '0' + (stats.mode & parseInt('777', 8)).toString(8);
        console.log(indent + item + ' [' + perms + ']');
      }
    });
  }

  listFiles(outputDir);

  // Show a sample generated file
  const sampleFile = path.join(outputDir, 'coordinator', 'gadget.sh');
  if (fs.existsSync(sampleFile)) {
    console.log('\n--- Sample Generated Script (coordinator/gadget.sh) ---');
    const content = fs.readFileSync(sampleFile, 'utf-8');
    console.log(content.split('\n').slice(0, 30).join('\n'));
    console.log('... (truncated)');
  }

}, 300);