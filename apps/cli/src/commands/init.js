"use strict";
/**
 * Initialize a new Bassline user installation
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initCommand = initCommand;
var fs_1 = require("fs");
var path_1 = require("path");
var os_1 = require("os");
var chalk_1 = require("chalk");
var inquirer_1 = require("inquirer");
var ora_1 = require("ora");
var child_process_1 = require("child_process");
var STORAGE_OPTIONS = [
    { name: 'Memory (included)', value: 'memory', included: true },
    { name: 'PostgreSQL', value: 'postgres', package: '@bassline/storage-postgres' },
    { name: 'Filesystem', value: 'filesystem', package: '@bassline/storage-filesystem' },
];
var TRANSPORT_OPTIONS = [
    { name: 'Local (included)', value: 'local', included: true },
    { name: 'WebSocket', value: 'websocket', package: '@bassline/transport-websocket' },
    { name: 'WebRTC', value: 'webrtc', package: '@bassline/transport-webrtc' },
];
function initCommand(options) {
    return __awaiter(this, void 0, void 0, function () {
        var defaultPath, existingPath, overwrite, answers, spinner, installSpinner, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log(chalk_1.default.blue.bold('\n🎵 Bassline Installation Setup\n'));
                    defaultPath = path_1.default.join(os_1.default.homedir(), '.bassline');
                    existingPath = process.env.BASSLINE_HOME || defaultPath;
                    return [4 /*yield*/, fileExists(existingPath)];
                case 1:
                    if (!((_a.sent()) && !options.path)) return [3 /*break*/, 3];
                    return [4 /*yield*/, inquirer_1.default.prompt([{
                                type: 'confirm',
                                name: 'overwrite',
                                message: "Installation already exists at ".concat(existingPath, ". Overwrite?"),
                                default: false
                            }])];
                case 2:
                    overwrite = (_a.sent()).overwrite;
                    if (!overwrite) {
                        console.log(chalk_1.default.yellow('Installation cancelled'));
                        return [2 /*return*/];
                    }
                    _a.label = 3;
                case 3:
                    if (!options.minimal) return [3 /*break*/, 4];
                    // Minimal setup - no prompts
                    answers = {
                        installPath: options.path || existingPath,
                        includeExamples: false,
                        storageBackends: ['memory'],
                        transportLayers: ['local'],
                        typescript: true,
                        addToPath: true
                    };
                    return [3 /*break*/, 7];
                case 4:
                    if (!options.from) return [3 /*break*/, 5];
                    // Install from template
                    answers = {
                        installPath: options.path || existingPath,
                        includeExamples: false,
                        storageBackends: ['memory'],
                        transportLayers: ['local'],
                        typescript: true,
                        addToPath: true
                    };
                    return [3 /*break*/, 7];
                case 5: return [4 /*yield*/, inquirer_1.default.prompt([
                        {
                            type: 'input',
                            name: 'installPath',
                            message: 'Installation directory:',
                            default: existingPath,
                            filter: function (input) {
                                if (input.startsWith('~')) {
                                    return path_1.default.join(os_1.default.homedir(), input.slice(1));
                                }
                                return path_1.default.resolve(input);
                            }
                        },
                        {
                            type: 'confirm',
                            name: 'includeExamples',
                            message: 'Include example plugins and basslines?',
                            default: true
                        },
                        {
                            type: 'checkbox',
                            name: 'storageBackends',
                            message: 'Select storage backends:',
                            choices: STORAGE_OPTIONS,
                            default: ['memory']
                        },
                        {
                            type: 'checkbox',
                            name: 'transportLayers',
                            message: 'Select transport layers:',
                            choices: TRANSPORT_OPTIONS,
                            default: ['local']
                        },
                        {
                            type: 'confirm',
                            name: 'typescript',
                            message: 'Use TypeScript?',
                            default: true
                        },
                        {
                            type: 'confirm',
                            name: 'addToPath',
                            message: 'Add to PATH?',
                            default: true
                        }
                    ])];
                case 6:
                    // Interactive setup
                    answers = _a.sent();
                    _a.label = 7;
                case 7:
                    spinner = (0, ora_1.default)('Creating installation...').start();
                    _a.label = 8;
                case 8:
                    _a.trys.push([8, 16, , 17]);
                    // Create directory structure
                    return [4 /*yield*/, createDirectoryStructure(answers.installPath)
                        // Copy or create files based on template
                    ];
                case 9:
                    // Create directory structure
                    _a.sent();
                    if (!options.from) return [3 /*break*/, 11];
                    return [4 /*yield*/, installFromTemplate(options.from, answers.installPath)];
                case 10:
                    _a.sent();
                    return [3 /*break*/, 13];
                case 11: return [4 /*yield*/, createInstallationFiles(answers)];
                case 12:
                    _a.sent();
                    _a.label = 13;
                case 13:
                    spinner.succeed('Installation created');
                    // Install dependencies
                    if (!options.skipInstall) {
                        installSpinner = (0, ora_1.default)('Installing dependencies...').start();
                        try {
                            (0, child_process_1.execSync)('npm install', {
                                cwd: answers.installPath,
                                stdio: 'ignore'
                            });
                            installSpinner.succeed('Dependencies installed');
                        }
                        catch (error) {
                            installSpinner.fail('Failed to install dependencies');
                            console.log(chalk_1.default.yellow('Run "npm install" manually in', answers.installPath));
                        }
                    }
                    if (!answers.addToPath) return [3 /*break*/, 15];
                    return [4 /*yield*/, addToPath(answers.installPath)];
                case 14:
                    _a.sent();
                    _a.label = 15;
                case 15:
                    // Success message
                    console.log(chalk_1.default.green.bold('\n✨ Installation complete!\n'));
                    console.log('Next steps:');
                    console.log(chalk_1.default.cyan('  cd ' + answers.installPath));
                    console.log(chalk_1.default.cyan('  npm run dev     # Start development mode'));
                    console.log(chalk_1.default.cyan('  bassline --help # See available commands'));
                    if (answers.addToPath) {
                        console.log(chalk_1.default.yellow('\n⚠️  Restart your terminal or run:'));
                        console.log(chalk_1.default.cyan('  source ~/.bashrc  # or ~/.zshrc'));
                    }
                    return [3 /*break*/, 17];
                case 16:
                    error_1 = _a.sent();
                    spinner.fail('Installation failed');
                    console.error(error_1);
                    process.exit(1);
                    return [3 /*break*/, 17];
                case 17: return [2 /*return*/];
            }
        });
    });
}
function createDirectoryStructure(installPath) {
    return __awaiter(this, void 0, void 0, function () {
        var dirs, _i, dirs_1, dir;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    dirs = [
                        installPath,
                        path_1.default.join(installPath, 'bin'),
                        path_1.default.join(installPath, 'plugins'),
                        path_1.default.join(installPath, 'plugins/storage'),
                        path_1.default.join(installPath, 'plugins/transport'),
                        path_1.default.join(installPath, 'plugins/gadgets'),
                        path_1.default.join(installPath, 'basslines'),
                        path_1.default.join(installPath, 'networks'),
                        path_1.default.join(installPath, 'daemon'),
                    ];
                    _i = 0, dirs_1 = dirs;
                    _a.label = 1;
                case 1:
                    if (!(_i < dirs_1.length)) return [3 /*break*/, 4];
                    dir = dirs_1[_i];
                    return [4 /*yield*/, fs_1.promises.mkdir(dir, { recursive: true })];
                case 2:
                    _a.sent();
                    _a.label = 3;
                case 3:
                    _i++;
                    return [3 /*break*/, 1];
                case 4: return [2 /*return*/];
            }
        });
    });
}
function createInstallationFiles(answers) {
    return __awaiter(this, void 0, void 0, function () {
        var installPath, includeExamples, storageBackends, transportLayers, typescript, packageJson, _loop_1, _i, storageBackends_1, backend, _loop_2, _a, transportLayers_1, transport, tsconfig, indexContent, binContent, binPath;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    installPath = answers.installPath, includeExamples = answers.includeExamples, storageBackends = answers.storageBackends, transportLayers = answers.transportLayers, typescript = answers.typescript;
                    packageJson = {
                        name: 'bassline-user-installation',
                        version: '1.0.0',
                        type: 'module',
                        private: true,
                        scripts: {
                            dev: typescript ? 'tsx watch index.ts' : 'node --watch index.js',
                            build: typescript ? 'tsc' : 'echo "No build needed"',
                            test: 'vitest',
                            upgrade: 'npm update @bassline/core @bassline/installation'
                        },
                        dependencies: {
                            '@bassline/core': '^0.1.0',
                            '@bassline/installation': '^0.1.0',
                            '@bassline/storage-memory': '^0.1.0',
                            tsx: typescript ? '^4.7.0' : undefined
                        },
                        devDependencies: typescript ? {
                            '@types/node': '^20.10.5',
                            typescript: '^5.3.3',
                            vitest: '^1.2.1'
                        } : {
                            vitest: '^1.2.1'
                        }
                    };
                    _loop_1 = function (backend) {
                        var option = STORAGE_OPTIONS.find(function (o) { return o.value === backend; });
                        if (option && 'package' in option && option.package) {
                            packageJson.dependencies[option.package] = '^0.1.0';
                        }
                    };
                    // Add selected storage backends
                    for (_i = 0, storageBackends_1 = storageBackends; _i < storageBackends_1.length; _i++) {
                        backend = storageBackends_1[_i];
                        _loop_1(backend);
                    }
                    _loop_2 = function (transport) {
                        var option = TRANSPORT_OPTIONS.find(function (o) { return o.value === transport; });
                        if (option && 'package' in option && option.package) {
                            packageJson.dependencies[option.package] = '^0.1.0';
                        }
                    };
                    // Add selected transport layers
                    for (_a = 0, transportLayers_1 = transportLayers; _a < transportLayers_1.length; _a++) {
                        transport = transportLayers_1[_a];
                        _loop_2(transport);
                    }
                    return [4 /*yield*/, fs_1.promises.writeFile(path_1.default.join(installPath, 'package.json'), JSON.stringify(packageJson, null, 2))
                        // Create tsconfig.json if using TypeScript
                    ];
                case 1:
                    _b.sent();
                    if (!typescript) return [3 /*break*/, 3];
                    tsconfig = {
                        compilerOptions: {
                            target: 'ES2022',
                            module: 'ESNext',
                            lib: ['ES2022'],
                            moduleResolution: 'bundler',
                            esModuleInterop: true,
                            skipLibCheck: true,
                            forceConsistentCasingInFileNames: true,
                            resolveJsonModule: true,
                            allowSyntheticDefaultImports: true,
                            strict: true,
                            noEmit: true
                        },
                        include: ['**/*.ts'],
                        exclude: ['node_modules']
                    };
                    return [4 /*yield*/, fs_1.promises.writeFile(path_1.default.join(installPath, 'tsconfig.json'), JSON.stringify(tsconfig, null, 2))];
                case 2:
                    _b.sent();
                    _b.label = 3;
                case 3:
                    indexContent = generateIndexFile(storageBackends, transportLayers, typescript, includeExamples);
                    return [4 /*yield*/, fs_1.promises.writeFile(path_1.default.join(installPath, typescript ? 'index.ts' : 'index.js'), indexContent)
                        // Create bin wrapper
                    ];
                case 4:
                    _b.sent();
                    binContent = "#!/usr/bin/env ".concat(typescript ? 'tsx' : 'node', "\nimport { CLI } from '@bassline/cli/runtime'\nimport installation from '../index.").concat(typescript ? 'ts' : 'js', "'\n\nconst cli = new CLI(installation)\ncli.run(process.argv)\n");
                    binPath = path_1.default.join(installPath, 'bin', 'bassline');
                    return [4 /*yield*/, fs_1.promises.writeFile(binPath, binContent)];
                case 5:
                    _b.sent();
                    return [4 /*yield*/, fs_1.promises.chmod(binPath, 493)
                        // Create example files if requested
                    ];
                case 6:
                    _b.sent();
                    if (!includeExamples) return [3 /*break*/, 8];
                    return [4 /*yield*/, createExampleFiles(installPath, typescript)];
                case 7:
                    _b.sent();
                    _b.label = 8;
                case 8: return [2 /*return*/];
            }
        });
    });
}
function generateIndexFile(storageBackends, transportLayers, typescript, includeExamples) {
    var imports = typescript ? "\nimport { BasslineInstallation } from '@bassline/installation'\nimport type { StorageFactory, TransportFactory } from '@bassline/installation'\n" : "\nimport { BasslineInstallation } from '@bassline/installation'\n";
    var storageConfig = storageBackends.map(function (backend) {
        if (backend === 'memory') {
            return "    memory: async () => {\n      const { createMemoryStorage } = await import('@bassline/storage-memory')\n      return createMemoryStorage\n    }";
        }
        else if (backend === 'postgres') {
            return "    postgres: async () => {\n      const { createPostgresStorage } = await import('@bassline/storage-postgres')\n      return createPostgresStorage\n    }";
        }
        else if (backend === 'filesystem') {
            return "    filesystem: async () => {\n      const { createFilesystemStorage } = await import('@bassline/storage-filesystem')\n      return createFilesystemStorage\n    }";
        }
        return '';
    }).filter(Boolean).join(',\n');
    var transportConfig = transportLayers.map(function (transport) {
        if (transport === 'local') {
            return "    local: async () => {\n      const { LocalTransport } = await import('@bassline/core')\n      return LocalTransport\n    }";
        }
        else if (transport === 'websocket') {
            return "    websocket: async () => {\n      const { WebSocketTransport } = await import('@bassline/transport-websocket')\n      return WebSocketTransport\n    }";
        }
        else if (transport === 'webrtc') {
            return "    webrtc: async () => {\n      const { WebRTCTransport } = await import('@bassline/transport-webrtc')\n      return WebRTCTransport\n    }";
        }
        return '';
    }).filter(Boolean).join(',\n');
    var basslinesConfig = includeExamples ? "\n  basslines: {\n    'example-math': () => import('./basslines/example-math'),\n    'example-string': () => import('./basslines/example-string')\n  }," : "\n  basslines: {},";
    return "/**\n * Bassline User Installation Configuration\n * \n * This file defines your personalized Bassline environment.\n * Add storage backends, transport layers, and basslines as needed.\n */\n".concat(imports, "\n\nexport default new BasslineInstallation({\n  // Storage backends\n  storage: {\n").concat(storageConfig, "\n  },\n  \n  // Transport layers\n  transports: {\n").concat(transportConfig, "\n  },\n  \n  // Pre-installed basslines\n").concat(basslinesConfig, "\n  \n  // Default configurations\n  defaults: {\n    storage: '").concat(storageBackends[0] || 'memory', "',\n    transport: '").concat(transportLayers[0] || 'local', "',\n    scheduler: 'immediate'\n  },\n  \n  // Lifecycle hooks (optional)\n  hooks: {\n    beforeNetworkStart: async (network) => {\n      console.log(`Starting network: ${network.id}`)\n    },\n    afterNetworkStart: async (network) => {\n      console.log(`Network started: ${network.id}`)\n    }\n  }\n})\n");
}
function createExampleFiles(installPath, typescript) {
    return __awaiter(this, void 0, void 0, function () {
        var ext, storageExample, basslineExample;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    ext = typescript ? 'ts' : 'js';
                    storageExample = "/**\n * Example custom storage backend\n */\n\n".concat(typescript ? "import type { NetworkStorage } from '@bassline/core'" : '', "\n\nexport class CustomStorage").concat(typescript ? ' implements NetworkStorage' : '', " {\n  async saveContactContent(networkId, groupId, contactId, content) {\n    console.log('Saving:', { networkId, groupId, contactId, content })\n  }\n  \n  async loadContactContent(networkId, groupId, contactId) {\n    console.log('Loading:', { networkId, groupId, contactId })\n    return null\n  }\n  \n  // ... implement other required methods\n}\n\nexport function createCustomStorage(config) {\n  return new CustomStorage(config)\n}\n");
                    return [4 /*yield*/, fs_1.promises.writeFile(path_1.default.join(installPath, 'plugins', 'storage', "custom-storage.".concat(ext)), storageExample)
                        // Example bassline
                    ];
                case 1:
                    _a.sent();
                    basslineExample = "/**\n * Example bassline with custom gadgets\n */\n\nexport const exampleMath = {\n  name: 'example-math',\n  version: '1.0.0',\n  attributes: {\n    'bassline.type': 'gadget-library',\n    'bassline.author': 'user'\n  },\n  gadgets: [\n    {\n      name: 'double',\n      primitive: async ({ value }) => {\n        return { result: value * 2 }\n      }\n    },\n    {\n      name: 'square',\n      primitive: async ({ value }) => {\n        return { result: value * value }\n      }\n    }\n  ]\n}\n";
                    return [4 /*yield*/, fs_1.promises.writeFile(path_1.default.join(installPath, 'basslines', "example-math.".concat(ext)), basslineExample)];
                case 2:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function installFromTemplate(template, installPath) {
    return __awaiter(this, void 0, void 0, function () {
        var repo;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!template.startsWith('github:')) return [3 /*break*/, 1];
                    repo = template.slice(7);
                    (0, child_process_1.execSync)("git clone https://github.com/".concat(repo, " ").concat(installPath), { stdio: 'ignore' });
                    return [3 /*break*/, 4];
                case 1:
                    if (!template.startsWith('@')) return [3 /*break*/, 2];
                    // Install from npm
                    (0, child_process_1.execSync)("npm pack ".concat(template), { cwd: os_1.default.tmpdir(), stdio: 'ignore' });
                    return [3 /*break*/, 4];
                case 2: return [4 /*yield*/, fileExists(template)];
                case 3:
                    if (_a.sent()) {
                        // Copy from local directory
                        (0, child_process_1.execSync)("cp -r ".concat(template, "/* ").concat(installPath, "/"), { stdio: 'ignore' });
                    }
                    else {
                        throw new Error("Unknown template source: ".concat(template));
                    }
                    _a.label = 4;
                case 4: return [2 /*return*/];
            }
        });
    });
}
function addToPath(installPath) {
    return __awaiter(this, void 0, void 0, function () {
        var binPath, exportLine, shell, shellConfig, configPath, content, error_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    binPath = path_1.default.join(installPath, 'bin');
                    exportLine = "export PATH=\"".concat(binPath, ":$PATH\"");
                    shell = process.env.SHELL || '/bin/bash';
                    shellConfig = shell.includes('zsh') ? '.zshrc' : '.bashrc';
                    configPath = path_1.default.join(os_1.default.homedir(), shellConfig);
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 5, , 6]);
                    return [4 /*yield*/, fs_1.promises.readFile(configPath, 'utf-8')];
                case 2:
                    content = _a.sent();
                    if (!!content.includes(binPath)) return [3 /*break*/, 4];
                    return [4 /*yield*/, fs_1.promises.appendFile(configPath, "\n# Bassline CLI\n".concat(exportLine, "\n"))];
                case 3:
                    _a.sent();
                    console.log(chalk_1.default.green("\u2713 Added to ".concat(shellConfig)));
                    _a.label = 4;
                case 4: return [3 /*break*/, 6];
                case 5:
                    error_2 = _a.sent();
                    console.log(chalk_1.default.yellow("Could not update ".concat(shellConfig, ". Add manually:")));
                    console.log(chalk_1.default.cyan("  echo '".concat(exportLine, "' >> ~/").concat(shellConfig)));
                    return [3 /*break*/, 6];
                case 6: return [2 /*return*/];
            }
        });
    });
}
function fileExists(filePath) {
    return __awaiter(this, void 0, void 0, function () {
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, fs_1.promises.access(filePath)];
                case 1:
                    _b.sent();
                    return [2 /*return*/, true];
                case 2:
                    _a = _b.sent();
                    return [2 /*return*/, false];
                case 3: return [2 /*return*/];
            }
        });
    });
}
