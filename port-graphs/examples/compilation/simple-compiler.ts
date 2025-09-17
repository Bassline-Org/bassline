#!/usr/bin/env tsx
/**
 * Simple compilation pipeline using just gadgets
 *
 * No classes, just gadgets wired together.
 */

import { createChoreographyParser } from '../../src/compilation/gadgets/parser-functional';
import { createSemanticValidator } from '../../src/compilation/gadgets/validator-functional';
import { createFilesystemCompiler } from '../../src/compilation/targets/filesystem-functional';
import { createFileMaterializer } from '../../src/compilation/gadgets/materializer-functional';

// Create our compilation gadgets
const parser = createChoreographyParser();
const validator = createSemanticValidator();
const compiler = createFilesystemCompiler({ outputPath: './generated' });
const materializer = createFileMaterializer({
  outputPath: './generated',
  dryRun: false
});

// Wire them together - simple mechanical wiring
const wire = (from: any, to: any, filter?: (effect: any) => boolean) => {
  const originalEmit = from.emit.bind(from);
  from.emit = (effect: any) => {
    originalEmit(effect);
    if (!filter || filter(effect)) {
      to.receive(effect);
    }
  };
};

// Parser → Validator (all effects)
wire(parser, validator);

// Parser → Compiler (AST updates only, for building local AST)
wire(parser, compiler, effect => 'astUpdate' in effect);

// Validator → Compiler (validation results only)
// Use setTimeout to ensure AST updates are processed first
const originalValidatorEmit = validator.emit.bind(validator);
validator.emit = (effect: any) => {
  originalValidatorEmit(effect);
  if ('validationResult' in effect && effect.validationResult.valid) {
    setTimeout(() => compiler.receive(effect), 10);
  }
};

// Compiler → Materializer (materialization requests only)
wire(compiler, materializer, effect => 'materialization' in effect);

// Example choreography
const choreography = `
name: example-app
roles:
  api:
    type: coordinator
    capabilities: [receive, route, emit]
  worker:
    type: processor
    capabilities: [process, compute]
  database:
    type: observer
    capabilities: [store, retrieve]
relationships:
  api -> worker: http
  worker -> database: tcp
`;

console.log('Compiling choreography...\n');
console.log(choreography);
console.log('\n---\n');

// Start compilation by sending to parser
parser.receive({
  source: choreography,
  path: 'example.yaml',
  format: 'yaml'
});

// Give gadgets time to process
setTimeout(() => {
  const compilerState = compiler.current();
  const materializerState = materializer.current();

  console.log('Compilation complete!');
  console.log(`- Parsed ${compilerState.ast.roles.size} roles`);
  console.log(`- Parsed ${compilerState.ast.relationships.size} relationships`);
  console.log(`- Generated ${compilerState.generatedArtifacts.size} artifacts`);
  console.log(`- Materialized ${materializerState.materializedFiles.size} files`);

  if (materializerState.materializedFiles.size > 0) {
    console.log('\nGenerated files:');
    materializerState.materializedFiles.forEach(file => {
      console.log(`  ${file}`);
    });
  }
}, 500);