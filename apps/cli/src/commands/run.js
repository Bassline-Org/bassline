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
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runNetwork = runNetwork;
var chalk_1 = require("chalk");
var ora_1 = require("ora");
var promises_1 = require("fs/promises");
var path_1 = require("path");
var StandaloneNetwork_js_1 = require("../runtime/StandaloneNetwork.js");
function runNetwork(file, options) {
    return __awaiter(this, void 0, void 0, function () {
        var spinner, filePath_1, content, networkData, network_1, reloadTimeout, watcher, _a, watcher_1, watcher_1_1, event_1, e_1_1, error_1;
        var _this = this;
        var _b, e_1, _c, _d;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    spinner = (0, ora_1.default)('Loading network file...').start();
                    _e.label = 1;
                case 1:
                    _e.trys.push([1, 17, , 18]);
                    filePath_1 = path_1.default.resolve(file);
                    return [4 /*yield*/, promises_1.default.readFile(filePath_1, 'utf-8')];
                case 2:
                    content = _e.sent();
                    networkData = JSON.parse(content);
                    spinner.text = 'Initializing network...';
                    network_1 = new StandaloneNetwork_js_1.StandaloneNetwork();
                    return [4 /*yield*/, network_1.initialize(options.scheduler)
                        // Import network state
                    ];
                case 3:
                    _e.sent();
                    // Import network state
                    return [4 /*yield*/, network_1.importState(networkData)];
                case 4:
                    // Import network state
                    _e.sent();
                    spinner.succeed(chalk_1.default.green('Network loaded and running'));
                    // Subscribe to changes
                    console.log(chalk_1.default.blue('\nNetwork activity:'));
                    network_1.subscribe(function (changes) {
                        changes.forEach(function (change) {
                            var timestamp = new Date().toISOString().split('T')[1].split('.')[0];
                            console.log(chalk_1.default.gray("[".concat(timestamp, "]")), chalk_1.default.yellow(change.type + ':'), formatChangeData(change.data));
                        });
                    });
                    if (!options.watch) return [3 /*break*/, 16];
                    console.log(chalk_1.default.gray("\nWatching ".concat(file, " for changes...")));
                    reloadTimeout = null;
                    watcher = promises_1.default.watch(filePath_1);
                    _e.label = 5;
                case 5:
                    _e.trys.push([5, 10, 11, 16]);
                    _a = true, watcher_1 = __asyncValues(watcher);
                    _e.label = 6;
                case 6: return [4 /*yield*/, watcher_1.next()];
                case 7:
                    if (!(watcher_1_1 = _e.sent(), _b = watcher_1_1.done, !_b)) return [3 /*break*/, 9];
                    _d = watcher_1_1.value;
                    _a = false;
                    event_1 = _d;
                    if (event_1.eventType === 'change') {
                        if (reloadTimeout)
                            clearTimeout(reloadTimeout);
                        reloadTimeout = setTimeout(function () { return __awaiter(_this, void 0, void 0, function () {
                            var newContent, newData, error_2;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        console.log(chalk_1.default.yellow('\nFile changed, reloading...'));
                                        _a.label = 1;
                                    case 1:
                                        _a.trys.push([1, 4, , 5]);
                                        return [4 /*yield*/, promises_1.default.readFile(filePath_1, 'utf-8')];
                                    case 2:
                                        newContent = _a.sent();
                                        newData = JSON.parse(newContent);
                                        return [4 /*yield*/, network_1.importState(newData)];
                                    case 3:
                                        _a.sent();
                                        console.log(chalk_1.default.green('Network reloaded'));
                                        return [3 /*break*/, 5];
                                    case 4:
                                        error_2 = _a.sent();
                                        console.error(chalk_1.default.red('Failed to reload:'), error_2.message);
                                        return [3 /*break*/, 5];
                                    case 5: return [2 /*return*/];
                                }
                            });
                        }); }, 100);
                    }
                    _e.label = 8;
                case 8:
                    _a = true;
                    return [3 /*break*/, 6];
                case 9: return [3 /*break*/, 16];
                case 10:
                    e_1_1 = _e.sent();
                    e_1 = { error: e_1_1 };
                    return [3 /*break*/, 16];
                case 11:
                    _e.trys.push([11, , 14, 15]);
                    if (!(!_a && !_b && (_c = watcher_1.return))) return [3 /*break*/, 13];
                    return [4 /*yield*/, _c.call(watcher_1)];
                case 12:
                    _e.sent();
                    _e.label = 13;
                case 13: return [3 /*break*/, 15];
                case 14:
                    if (e_1) throw e_1.error;
                    return [7 /*endfinally*/];
                case 15: return [7 /*endfinally*/];
                case 16:
                    console.log(chalk_1.default.gray('\nPress Ctrl+C to stop'));
                    // Handle shutdown
                    process.on('SIGINT', function () { return __awaiter(_this, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    console.log(chalk_1.default.yellow('\nShutting down...'));
                                    return [4 /*yield*/, network_1.terminate()];
                                case 1:
                                    _a.sent();
                                    process.exit(0);
                                    return [2 /*return*/];
                            }
                        });
                    }); });
                    return [3 /*break*/, 18];
                case 17:
                    error_1 = _e.sent();
                    spinner.fail(chalk_1.default.red('Failed to run network'));
                    console.error(error_1);
                    process.exit(1);
                    return [3 /*break*/, 18];
                case 18: return [2 /*return*/];
            }
        });
    });
}
function formatChangeData(data) {
    if (typeof data === 'object' && data !== null) {
        if (data.contact) {
            return "Contact ".concat(data.contact.id.slice(0, 8), " = ").concat(JSON.stringify(data.contact.content));
        }
        if (data.wire) {
            return "Wire ".concat(data.wire.id.slice(0, 8), ": ").concat(data.wire.fromId.slice(0, 8), " \u2192 ").concat(data.wire.toId.slice(0, 8));
        }
        if (data.groupId) {
            return "Group ".concat(data.groupId.slice(0, 8));
        }
    }
    return JSON.stringify(data);
}
