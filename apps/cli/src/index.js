#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var commander_1 = require("commander");
var start_js_1 = require("./commands/start.js");
var run_js_1 = require("./commands/run.js");
var connect_js_1 = require("./commands/connect.js");
var export_js_1 = require("./commands/export.js");
var import_js_1 = require("./commands/import.js");
var signal_js_1 = require("./commands/signal.js");
var init_js_1 = require("./commands/init.js");
var program = new commander_1.Command();
program
    .name('bassline')
    .description('CLI for managing Bassline propagation networks')
    .version('0.1.0');
program
    .command('init')
    .description('Initialize a new Bassline installation')
    .option('-p, --path <path>', 'installation directory')
    .option('-f, --from <template>', 'install from template')
    .option('-m, --minimal', 'minimal installation (no prompts)')
    .option('--skip-install', 'skip npm install')
    .action(init_js_1.initCommand);
program
    .command('start')
    .description('Start a propagation network server')
    .option('-p, --port <port>', 'port to listen on', '8455')
    .option('-n, --name <name>', 'network name', 'default')
    .action(start_js_1.startServer);
program
    .command('run <file>')
    .description('Run a network from a file')
    .option('-w, --watch', 'watch for changes')
    .option('-s, --scheduler <type>', 'scheduler type (immediate, batch)', 'immediate')
    .action(run_js_1.runNetwork);
program
    .command('connect <url>')
    .description('Connect to a running network')
    .option('--no-interactive', 'disable interactive mode')
    .action(connect_js_1.connectToNetwork);
program
    .command('export <file>')
    .description('Export current network state')
    .option('-g, --group <id>', 'group to export', 'root')
    .action(export_js_1.exportNetwork);
program
    .command('import <file>')
    .description('Import network state from file')
    .option('-m, --merge', 'merge with existing network')
    .action(import_js_1.importNetwork);
// Add signal command for WebRTC
program.addCommand((0, signal_js_1.createSignalCommand)());
program.parse();
// Show help if no command provided
if (!process.argv.slice(2).length) {
    program.outputHelp();
}
