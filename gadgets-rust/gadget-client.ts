#!/usr/bin/env npx tsx

// TypeScript gadget client - connects to Rust gadget server
// Demonstrates how TypeScript gadgets can interact with Rust gadgets

import * as net from 'net';
import * as readline from 'readline';

const GADGET_SERVER = '127.0.0.1';
const GADGET_PORT = 9999;

// Send command to gadget server
function sendCommand(command: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const client = new net.Socket();

    client.connect(GADGET_PORT, GADGET_SERVER, () => {
      client.write(command + '\n');
    });

    client.on('data', (data) => {
      resolve(data.toString().trim());
      client.destroy();
    });

    client.on('error', (err) => {
      reject(err);
    });

    client.on('timeout', () => {
      reject(new Error('Connection timeout'));
      client.destroy();
    });

    client.setTimeout(1000);
  });
}

// TypeScript Gadget wrappers
class CounterGadget {
  async increment(): Promise<number> {
    const result = await sendCommand('counter receive increment');
    return parseInt(result);
  }

  async decrement(): Promise<number> {
    const result = await sendCommand('counter receive decrement');
    return parseInt(result);
  }

  async reset(): Promise<number> {
    const result = await sendCommand('counter receive reset');
    return parseInt(result);
  }

  async current(): Promise<number> {
    const result = await sendCommand('counter current');
    return parseInt(result);
  }
}

class MaxCellGadget {
  async receive(value: number): Promise<number> {
    const result = await sendCommand(`maxcell receive ${value}`);
    return parseInt(result);
  }

  async current(): Promise<number> {
    const result = await sendCommand('maxcell current');
    return parseInt(result);
  }
}

// Create a TypeScript-native gadget that taps into Rust gadgets
class CompositeGadget {
  private counter: CounterGadget;
  private maxCell: MaxCellGadget;
  private localState: number = 0;

  constructor() {
    this.counter = new CounterGadget();
    this.maxCell = new MaxCellGadget();
  }

  async receive(data: string): Promise<void> {
    console.log(`CompositeGadget received: ${data}`);

    switch (data) {
      case 'increment':
        const newCount = await this.counter.increment();
        console.log(`Counter incremented to: ${newCount}`);

        // Update maxcell if counter is higher
        const maxValue = await this.maxCell.receive(newCount);
        console.log(`MaxCell updated to: ${maxValue}`);

        this.localState = maxValue;
        this.emit({ changed: this.localState });
        break;

      case 'double':
        const current = await this.counter.current();
        const doubled = current * 2;
        const max = await this.maxCell.receive(doubled);
        console.log(`Doubled ${current} to ${doubled}, max is now ${max}`);

        this.localState = max;
        this.emit({ changed: this.localState });
        break;

      default:
        console.log(`Unknown command: ${data}`);
        this.emit({ noop: true });
    }
  }

  emit(effect: any): void {
    console.log('CompositeGadget emitted:', effect);
  }

  current(): number {
    return this.localState;
  }
}

// Interactive REPL
async function repl() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: 'ts-gadget> '
  });

  const counter = new CounterGadget();
  const maxCell = new MaxCellGadget();
  const composite = new CompositeGadget();

  console.log('TypeScript Gadget Client');
  console.log('Commands: counter [inc|dec|reset|current], maxcell [set N|current], composite [increment|double], list, quit');
  console.log('');

  rl.prompt();

  rl.on('line', async (line) => {
    const [cmd, ...args] = line.trim().split(' ');

    try {
      switch (cmd) {
        case 'counter':
          const action = args[0] || 'current';
          let counterResult;
          switch (action) {
            case 'inc':
            case 'increment':
              counterResult = await counter.increment();
              break;
            case 'dec':
            case 'decrement':
              counterResult = await counter.decrement();
              break;
            case 'reset':
              counterResult = await counter.reset();
              break;
            default:
              counterResult = await counter.current();
          }
          console.log(`Counter: ${counterResult}`);
          break;

        case 'maxcell':
          if (args[0] === 'set' && args[1]) {
            const value = parseInt(args[1]);
            const result = await maxCell.receive(value);
            console.log(`MaxCell: ${result}`);
          } else {
            const current = await maxCell.current();
            console.log(`MaxCell: ${current}`);
          }
          break;

        case 'composite':
          const compositeAction = args[0] || 'increment';
          await composite.receive(compositeAction);
          break;

        case 'list':
          const gadgets = await sendCommand('gadgets list');
          console.log(gadgets);
          break;

        case 'quit':
        case 'exit':
          console.log('Goodbye!');
          rl.close();
          process.exit(0);

        case '':
          break;

        default:
          console.log(`Unknown command: ${cmd}`);
      }
    } catch (err) {
      console.error(`Error: ${err}`);
    }

    rl.prompt();
  });
}

// Example: Demonstrating cross-language gadget composition
async function demo() {
  console.log('=== Cross-Language Gadget Demo ===\n');

  const counter = new CounterGadget();
  const maxCell = new MaxCellGadget();

  console.log('Initial states:');
  console.log(`  Counter: ${await counter.current()}`);
  console.log(`  MaxCell: ${await maxCell.current()}`);

  console.log('\nIncrementing counter 3 times...');
  for (let i = 0; i < 3; i++) {
    const value = await counter.increment();
    console.log(`  Counter -> ${value}`);
  }

  console.log('\nUpdating MaxCell with counter value...');
  const counterValue = await counter.current();
  const maxValue = await maxCell.receive(counterValue);
  console.log(`  MaxCell -> ${maxValue}`);

  console.log('\nTrying to set MaxCell to lower value (2)...');
  const newMax = await maxCell.receive(2);
  console.log(`  MaxCell -> ${newMax} (should stay at ${maxValue})`);

  console.log('\n=== Demo Complete ===\n');
}

// Main entry point
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === 'repl') {
    await repl();
  } else if (args[0] === 'demo') {
    await demo();
    process.exit(0);
  } else {
    // Direct command
    try {
      const result = await sendCommand(args.join(' '));
      console.log(result);
    } catch (err) {
      console.error(`Error: ${err}`);
      process.exit(1);
    }
  }
}

main().catch(console.error);