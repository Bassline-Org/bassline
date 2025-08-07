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
exports.importNetwork = importNetwork;
var chalk_1 = require("chalk");
var ora_1 = require("ora");
var promises_1 = require("fs/promises");
var path_1 = require("path");
var StandaloneNetwork_js_1 = require("../runtime/StandaloneNetwork.js");
function importNetwork(file, options) {
    return __awaiter(this, void 0, void 0, function () {
        var spinner, filePath, content, networkData, network, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    spinner = (0, ora_1.default)('Reading network file...').start();
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 6, , 7]);
                    filePath = path_1.default.resolve(file);
                    return [4 /*yield*/, promises_1.default.readFile(filePath, 'utf-8')];
                case 2:
                    content = _a.sent();
                    networkData = JSON.parse(content);
                    spinner.text = 'Initializing network...';
                    network = new StandaloneNetwork_js_1.StandaloneNetwork();
                    return [4 /*yield*/, network.initialize()];
                case 3:
                    _a.sent();
                    spinner.text = 'Importing network state...';
                    // Import state
                    return [4 /*yield*/, network.importState(networkData)];
                case 4:
                    // Import state
                    _a.sent();
                    spinner.succeed(chalk_1.default.green('Network imported successfully'));
                    // Show summary
                    console.log(chalk_1.default.blue('\nImport summary:'));
                    if (networkData.groups) {
                        console.log(chalk_1.default.gray("  Groups: ".concat(Object.keys(networkData.groups).length)));
                    }
                    if (networkData.contacts) {
                        console.log(chalk_1.default.gray("  Contacts: ".concat(Object.keys(networkData.contacts).length)));
                    }
                    if (networkData.wires) {
                        console.log(chalk_1.default.gray("  Wires: ".concat(Object.keys(networkData.wires).length)));
                    }
                    return [4 /*yield*/, network.terminate()];
                case 5:
                    _a.sent();
                    return [3 /*break*/, 7];
                case 6:
                    error_1 = _a.sent();
                    spinner.fail(chalk_1.default.red('Failed to import network'));
                    console.error(error_1);
                    process.exit(1);
                    return [3 /*break*/, 7];
                case 7: return [2 /*return*/];
            }
        });
    });
}
