"use strict";
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
exports.connectToNetwork = connectToNetwork;
var chalk_1 = require("chalk");
var ora_1 = require("ora");
function connectToNetwork(url, options) {
    return __awaiter(this, void 0, void 0, function () {
        var spinner, controller_1, timeout, testResponse, error_1, state, error_2, readline, rl_1, error_3;
        var _this = this;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    spinner = (0, ora_1.default)('Connecting to network...').start();
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 12, , 13]);
                    // Validate URL
                    new URL(url);
                    // Test connection by fetching root state
                    spinner.text = 'Testing connection...';
                    controller_1 = new AbortController();
                    timeout = setTimeout(function () { return controller_1.abort(); }, 5000) // 5 second timeout
                    ;
                    testResponse = void 0;
                    _b.label = 2;
                case 2:
                    _b.trys.push([2, 4, , 5]);
                    return [4 /*yield*/, fetch("".concat(url, "/state?groupId=root"), {
                            signal: controller_1.signal
                        })];
                case 3:
                    testResponse = _b.sent();
                    clearTimeout(timeout);
                    if (!testResponse.ok) {
                        throw new Error("Server responded with ".concat(testResponse.status, ": ").concat(testResponse.statusText));
                    }
                    return [3 /*break*/, 5];
                case 4:
                    error_1 = _b.sent();
                    clearTimeout(timeout);
                    if (error_1.name === 'AbortError') {
                        throw new Error('Connection timeout - server did not respond');
                    }
                    if (((_a = error_1.cause) === null || _a === void 0 ? void 0 : _a.code) === 'ECONNREFUSED') {
                        throw new Error("Cannot connect to server at ".concat(url, " - is it running?"));
                    }
                    throw error_1;
                case 5:
                    _b.trys.push([5, 7, , 8]);
                    return [4 /*yield*/, testResponse.json()];
                case 6:
                    state = _b.sent();
                    if (!state.group || !state.contacts || !state.wires) {
                        throw new Error('Server does not appear to be a Bassline network server');
                    }
                    return [3 /*break*/, 8];
                case 7:
                    error_2 = _b.sent();
                    if (error_2.message.includes('JSON')) {
                        throw new Error('Server response is not valid JSON - not a Bassline server');
                    }
                    throw error_2;
                case 8:
                    spinner.succeed(chalk_1.default.green("Connected to ".concat(url)));
                    if (!(options.interactive !== false)) return [3 /*break*/, 11];
                    console.log(chalk_1.default.blue('\nInteractive mode - type "help" for commands'));
                    console.log(chalk_1.default.gray('Type "exit" to disconnect\n'));
                    return [4 /*yield*/, Promise.resolve().then(function () { return require('readline'); })];
                case 9:
                    readline = _b.sent();
                    rl_1 = readline.createInterface({
                        input: process.stdin,
                        output: process.stdout,
                        prompt: chalk_1.default.cyan('> ')
                    });
                    // Prompt and start listening
                    rl_1.prompt();
                    rl_1.on('line', function (line) { return __awaiter(_this, void 0, void 0, function () {
                        var command, _a, cmd, args, _b, groupId, response, state, error_4, response, result, error_5, response, result, error_6, response, groups, error_7, response, primitives, error_8, response, result, error_9, response, error_10, response, error_11, response, error_12, response, error_13;
                        return __generator(this, function (_c) {
                            switch (_c.label) {
                                case 0:
                                    command = line.trim();
                                    if (!command) {
                                        rl_1.prompt();
                                        return [2 /*return*/];
                                    }
                                    _a = command.split(' '), cmd = _a[0], args = _a.slice(1);
                                    _b = cmd;
                                    switch (_b) {
                                        case 'help': return [3 /*break*/, 1];
                                        case 'state': return [3 /*break*/, 2];
                                        case 'add': return [3 /*break*/, 8];
                                        case 'connect': return [3 /*break*/, 14];
                                        case 'groups': return [3 /*break*/, 20];
                                        case 'primitives': return [3 /*break*/, 25];
                                        case 'create-group': return [3 /*break*/, 30];
                                        case 'delete-group': return [3 /*break*/, 36];
                                        case 'delete-contact': return [3 /*break*/, 42];
                                        case 'delete-wire': return [3 /*break*/, 48];
                                        case 'update': return [3 /*break*/, 54];
                                        case 'exit': return [3 /*break*/, 60];
                                        case 'quit': return [3 /*break*/, 60];
                                    }
                                    return [3 /*break*/, 61];
                                case 1:
                                    console.log(chalk_1.default.gray('Commands:'));
                                    console.log(chalk_1.default.gray('  state [groupId]          - Show group state'));
                                    console.log(chalk_1.default.gray('  groups                   - List all groups'));
                                    console.log(chalk_1.default.gray('  primitives               - List available primitives'));
                                    console.log(chalk_1.default.gray('  create-group <name> [parentId] [primitiveId] - Create new group'));
                                    console.log(chalk_1.default.gray('  delete-group <id>        - Delete a group'));
                                    console.log(chalk_1.default.gray('  add <groupId> <content>  - Add contact'));
                                    console.log(chalk_1.default.gray('  delete-contact <id>      - Delete a contact'));
                                    console.log(chalk_1.default.gray('  connect <from> <to>      - Connect contacts'));
                                    console.log(chalk_1.default.gray('  delete-wire <id>         - Delete a wire'));
                                    console.log(chalk_1.default.gray('  update <id> <content>    - Update contact'));
                                    console.log(chalk_1.default.gray('  exit                     - Disconnect'));
                                    return [3 /*break*/, 62];
                                case 2:
                                    groupId = args[0] || 'root';
                                    _c.label = 3;
                                case 3:
                                    _c.trys.push([3, 6, , 7]);
                                    return [4 /*yield*/, fetch("".concat(url, "/state?groupId=").concat(groupId))];
                                case 4:
                                    response = _c.sent();
                                    return [4 /*yield*/, response.json()];
                                case 5:
                                    state = _c.sent();
                                    console.log(chalk_1.default.gray(JSON.stringify(state, null, 2)));
                                    return [3 /*break*/, 7];
                                case 6:
                                    error_4 = _c.sent();
                                    console.error(chalk_1.default.red('Failed to get state:'), error_4.message);
                                    return [3 /*break*/, 7];
                                case 7: return [3 /*break*/, 62];
                                case 8:
                                    if (args.length < 2) {
                                        console.log(chalk_1.default.red('Usage: add <groupId> <content>'));
                                        return [3 /*break*/, 62];
                                    }
                                    _c.label = 9;
                                case 9:
                                    _c.trys.push([9, 12, , 13]);
                                    return [4 /*yield*/, fetch("".concat(url, "/contact"), {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({
                                                groupId: args[0],
                                                contact: {
                                                    content: args.slice(1).join(' '),
                                                    blendMode: 'accept-last'
                                                }
                                            })
                                        })];
                                case 10:
                                    response = _c.sent();
                                    return [4 /*yield*/, response.json()];
                                case 11:
                                    result = _c.sent();
                                    console.log(chalk_1.default.green('Contact added:'), result.contactId);
                                    return [3 /*break*/, 13];
                                case 12:
                                    error_5 = _c.sent();
                                    console.error(chalk_1.default.red('Failed to add contact:'), error_5.message);
                                    return [3 /*break*/, 13];
                                case 13: return [3 /*break*/, 62];
                                case 14:
                                    if (args.length < 2) {
                                        console.log(chalk_1.default.red('Usage: connect <fromId> <toId>'));
                                        return [3 /*break*/, 62];
                                    }
                                    _c.label = 15;
                                case 15:
                                    _c.trys.push([15, 18, , 19]);
                                    return [4 /*yield*/, fetch("".concat(url, "/connect"), {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({
                                                fromId: args[0],
                                                toId: args[1],
                                                type: 'bidirectional'
                                            })
                                        })];
                                case 16:
                                    response = _c.sent();
                                    return [4 /*yield*/, response.json()];
                                case 17:
                                    result = _c.sent();
                                    console.log(chalk_1.default.green('Wire created:'), result.wireId);
                                    return [3 /*break*/, 19];
                                case 18:
                                    error_6 = _c.sent();
                                    console.error(chalk_1.default.red('Failed to connect:'), error_6.message);
                                    return [3 /*break*/, 19];
                                case 19: return [3 /*break*/, 62];
                                case 20:
                                    _c.trys.push([20, 23, , 24]);
                                    return [4 /*yield*/, fetch("".concat(url, "/groups"))];
                                case 21:
                                    response = _c.sent();
                                    return [4 /*yield*/, response.json()];
                                case 22:
                                    groups = _c.sent();
                                    console.log(chalk_1.default.blue('Groups:'));
                                    groups.forEach(function (group) {
                                        var indent = group.parentId && group.parentId !== 'root' ? '  ' : '';
                                        var type = group.primitiveId ? " (".concat(group.primitiveId, ")") : '';
                                        console.log(chalk_1.default.gray("".concat(indent).concat(group.id, ": ").concat(group.name).concat(type)));
                                        console.log(chalk_1.default.gray("".concat(indent, "  Contacts: ").concat(group.contactCount, ", Wires: ").concat(group.wireCount, ", Subgroups: ").concat(group.subgroupCount)));
                                    });
                                    return [3 /*break*/, 24];
                                case 23:
                                    error_7 = _c.sent();
                                    console.error(chalk_1.default.red('Failed to list groups:'), error_7.message);
                                    return [3 /*break*/, 24];
                                case 24: return [3 /*break*/, 62];
                                case 25:
                                    _c.trys.push([25, 28, , 29]);
                                    return [4 /*yield*/, fetch("".concat(url, "/primitives"))];
                                case 26:
                                    response = _c.sent();
                                    return [4 /*yield*/, response.json()];
                                case 27:
                                    primitives = _c.sent();
                                    console.log(chalk_1.default.blue('Available primitives:'));
                                    primitives.forEach(function (prim) {
                                        console.log(chalk_1.default.gray("".concat(prim.id, ": ").concat(prim.name, " - ").concat(prim.description)));
                                        console.log(chalk_1.default.gray("  Inputs: ".concat(prim.inputs.map(function (i) { return i.name; }).join(', '))));
                                        console.log(chalk_1.default.gray("  Outputs: ".concat(prim.outputs.map(function (o) { return o.name; }).join(', '))));
                                    });
                                    return [3 /*break*/, 29];
                                case 28:
                                    error_8 = _c.sent();
                                    console.error(chalk_1.default.red('Failed to list primitives:'), error_8.message);
                                    return [3 /*break*/, 29];
                                case 29: return [3 /*break*/, 62];
                                case 30:
                                    if (args.length < 1) {
                                        console.log(chalk_1.default.red('Usage: create-group <name> [parentId] [primitiveId]'));
                                        return [3 /*break*/, 62];
                                    }
                                    _c.label = 31;
                                case 31:
                                    _c.trys.push([31, 34, , 35]);
                                    return [4 /*yield*/, fetch("".concat(url, "/groups"), {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({
                                                name: args[0],
                                                parentId: args[1],
                                                primitiveId: args[2]
                                            })
                                        })];
                                case 32:
                                    response = _c.sent();
                                    return [4 /*yield*/, response.json()];
                                case 33:
                                    result = _c.sent();
                                    console.log(chalk_1.default.green('Group created:'), result.groupId);
                                    return [3 /*break*/, 35];
                                case 34:
                                    error_9 = _c.sent();
                                    console.error(chalk_1.default.red('Failed to create group:'), error_9.message);
                                    return [3 /*break*/, 35];
                                case 35: return [3 /*break*/, 62];
                                case 36:
                                    if (args.length < 1) {
                                        console.log(chalk_1.default.red('Usage: delete-group <groupId>'));
                                        return [3 /*break*/, 62];
                                    }
                                    _c.label = 37;
                                case 37:
                                    _c.trys.push([37, 40, , 41]);
                                    return [4 /*yield*/, fetch("".concat(url, "/groups/").concat(args[0]), {
                                            method: 'DELETE'
                                        })];
                                case 38:
                                    response = _c.sent();
                                    return [4 /*yield*/, response.json()];
                                case 39:
                                    _c.sent();
                                    console.log(chalk_1.default.green('Group deleted'));
                                    return [3 /*break*/, 41];
                                case 40:
                                    error_10 = _c.sent();
                                    console.error(chalk_1.default.red('Failed to delete group:'), error_10.message);
                                    return [3 /*break*/, 41];
                                case 41: return [3 /*break*/, 62];
                                case 42:
                                    if (args.length < 1) {
                                        console.log(chalk_1.default.red('Usage: delete-contact <contactId>'));
                                        return [3 /*break*/, 62];
                                    }
                                    _c.label = 43;
                                case 43:
                                    _c.trys.push([43, 46, , 47]);
                                    return [4 /*yield*/, fetch("".concat(url, "/contact/").concat(args[0]), {
                                            method: 'DELETE'
                                        })];
                                case 44:
                                    response = _c.sent();
                                    return [4 /*yield*/, response.json()];
                                case 45:
                                    _c.sent();
                                    console.log(chalk_1.default.green('Contact deleted'));
                                    return [3 /*break*/, 47];
                                case 46:
                                    error_11 = _c.sent();
                                    console.error(chalk_1.default.red('Failed to delete contact:'), error_11.message);
                                    return [3 /*break*/, 47];
                                case 47: return [3 /*break*/, 62];
                                case 48:
                                    if (args.length < 1) {
                                        console.log(chalk_1.default.red('Usage: delete-wire <wireId>'));
                                        return [3 /*break*/, 62];
                                    }
                                    _c.label = 49;
                                case 49:
                                    _c.trys.push([49, 52, , 53]);
                                    return [4 /*yield*/, fetch("".concat(url, "/wire/").concat(args[0]), {
                                            method: 'DELETE'
                                        })];
                                case 50:
                                    response = _c.sent();
                                    return [4 /*yield*/, response.json()];
                                case 51:
                                    _c.sent();
                                    console.log(chalk_1.default.green('Wire deleted'));
                                    return [3 /*break*/, 53];
                                case 52:
                                    error_12 = _c.sent();
                                    console.error(chalk_1.default.red('Failed to delete wire:'), error_12.message);
                                    return [3 /*break*/, 53];
                                case 53: return [3 /*break*/, 62];
                                case 54:
                                    if (args.length < 2) {
                                        console.log(chalk_1.default.red('Usage: update <contactId> <content>'));
                                        return [3 /*break*/, 62];
                                    }
                                    _c.label = 55;
                                case 55:
                                    _c.trys.push([55, 58, , 59]);
                                    return [4 /*yield*/, fetch("".concat(url, "/update"), {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({
                                                contactId: args[0],
                                                content: args.slice(1).join(' ')
                                            })
                                        })];
                                case 56:
                                    response = _c.sent();
                                    return [4 /*yield*/, response.json()];
                                case 57:
                                    _c.sent();
                                    console.log(chalk_1.default.green('Contact updated'));
                                    return [3 /*break*/, 59];
                                case 58:
                                    error_13 = _c.sent();
                                    console.error(chalk_1.default.red('Failed to update:'), error_13.message);
                                    return [3 /*break*/, 59];
                                case 59: return [3 /*break*/, 62];
                                case 60:
                                    console.log(chalk_1.default.yellow('Disconnected'));
                                    rl_1.close();
                                    process.exit(0);
                                    _c.label = 61;
                                case 61:
                                    if (cmd) {
                                        console.log(chalk_1.default.red("Unknown command: ".concat(cmd)));
                                    }
                                    _c.label = 62;
                                case 62:
                                    // Show prompt for next command
                                    rl_1.prompt();
                                    return [2 /*return*/];
                            }
                        });
                    }); });
                    // Handle Ctrl+C
                    rl_1.on('SIGINT', function () {
                        console.log(chalk_1.default.yellow('\nDisconnected'));
                        process.exit(0);
                    });
                    // Handle close event
                    rl_1.on('close', function () {
                        console.log(chalk_1.default.yellow('Disconnected'));
                        process.exit(0);
                    });
                    // Keep the process alive by preventing the function from returning
                    return [4 /*yield*/, new Promise(function (resolve) {
                            rl_1.on('close', resolve);
                        })];
                case 10:
                    // Keep the process alive by preventing the function from returning
                    _b.sent();
                    _b.label = 11;
                case 11: return [3 /*break*/, 13];
                case 12:
                    error_3 = _b.sent();
                    spinner.fail(chalk_1.default.red('Failed to connect'));
                    console.error(error_3);
                    process.exit(1);
                    return [3 /*break*/, 13];
                case 13: return [2 /*return*/];
            }
        });
    });
}
