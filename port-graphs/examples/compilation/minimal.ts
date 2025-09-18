#!/usr/bin/env tsx
/**
 * Minimal compilation example
 */

import { compile } from '../../src/compile';

const choreography = `
roles:
  frontend: web
  api: service
  database: storage
relationships:
  frontend -> api: http
  api -> database: postgres
`;

console.log('Compiling choreography...');
const count = compile(choreography);
console.log(`Generated ${count} gadgets`);

// Show what was generated
import * as fs from 'fs';
console.log('\nGenerated structure:');
fs.readdirSync('./generated').forEach(dir => {
  console.log(`  ${dir}/`);
  fs.readdirSync(`./generated/${dir}`).forEach(file => {
    console.log(`    ${file}`);
  });
});