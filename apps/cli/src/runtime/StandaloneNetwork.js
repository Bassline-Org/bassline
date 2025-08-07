"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
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
exports.StandaloneNetwork = void 0;
var events_1 = require("events");
var NetworkRuntime_js_1 = require("./NetworkRuntime.js");
var StandaloneNetwork = /** @class */ (function (_super) {
    __extends(StandaloneNetwork, _super);
    function StandaloneNetwork() {
        var _this = _super.call(this) || this;
        _this.subscriptionHandlers = [];
        _this.changeInterval = null;
        _this.runtime = new NetworkRuntime_js_1.NetworkRuntime();
        return _this;
    }
    StandaloneNetwork.prototype.initialize = function () {
        return __awaiter(this, arguments, void 0, function (scheduler) {
            var _this = this;
            if (scheduler === void 0) { scheduler = 'immediate'; }
            return __generator(this, function (_a) {
                // Subscribe to runtime changes
                this.runtime.on('change', function (change) {
                    _this.emit('change', change);
                });
                // Poll for batched changes
                this.changeInterval = setInterval(function () {
                    var changes = _this.runtime.getChanges();
                    if (changes.length > 0) {
                        _this.subscriptionHandlers.forEach(function (handler) { return handler(changes); });
                        _this.emit('changes', changes);
                    }
                }, 100);
                return [2 /*return*/, Promise.resolve()];
            });
        });
    };
    StandaloneNetwork.prototype.registerGroup = function (group) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                this.runtime.registerGroup(group);
                return [2 /*return*/, Promise.resolve()];
            });
        });
    };
    StandaloneNetwork.prototype.addContact = function (groupId, contact) {
        return __awaiter(this, void 0, void 0, function () {
            var contactId;
            return __generator(this, function (_a) {
                contactId = this.runtime.addContact(groupId, contact);
                return [2 /*return*/, Promise.resolve(contactId)];
            });
        });
    };
    StandaloneNetwork.prototype.connect = function (fromId_1, toId_1) {
        return __awaiter(this, arguments, void 0, function (fromId, toId, type) {
            var wireId;
            if (type === void 0) { type = 'bidirectional'; }
            return __generator(this, function (_a) {
                wireId = this.runtime.connect(fromId, toId, type);
                return [2 /*return*/, Promise.resolve(wireId)];
            });
        });
    };
    StandaloneNetwork.prototype.scheduleUpdate = function (contactId, content) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                this.runtime.scheduleUpdate(contactId, content);
                return [2 /*return*/, Promise.resolve()];
            });
        });
    };
    StandaloneNetwork.prototype.getState = function () {
        return __awaiter(this, arguments, void 0, function (groupId) {
            if (groupId === void 0) { groupId = 'root'; }
            return __generator(this, function (_a) {
                return [2 /*return*/, Promise.resolve(this.runtime.getState(groupId))];
            });
        });
    };
    StandaloneNetwork.prototype.exportState = function () {
        return __awaiter(this, arguments, void 0, function (groupId) {
            if (groupId === void 0) { groupId = 'root'; }
            return __generator(this, function (_a) {
                return [2 /*return*/, Promise.resolve(this.runtime.exportState(groupId))];
            });
        });
    };
    StandaloneNetwork.prototype.importState = function (state) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                this.runtime.importState(state);
                return [2 /*return*/, Promise.resolve()];
            });
        });
    };
    StandaloneNetwork.prototype.subscribe = function (handler) {
        var _this = this;
        this.subscriptionHandlers.push(handler);
        return function () {
            var index = _this.subscriptionHandlers.indexOf(handler);
            if (index >= 0) {
                _this.subscriptionHandlers.splice(index, 1);
            }
        };
    };
    StandaloneNetwork.prototype.listGroups = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, Promise.resolve(this.runtime.listGroups())];
            });
        });
    };
    StandaloneNetwork.prototype.createGroup = function (name, parentId, primitiveId) {
        return __awaiter(this, void 0, void 0, function () {
            var groupId;
            return __generator(this, function (_a) {
                groupId = this.runtime.createGroup(name, parentId, primitiveId);
                return [2 /*return*/, Promise.resolve(groupId)];
            });
        });
    };
    StandaloneNetwork.prototype.deleteGroup = function (groupId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                this.runtime.deleteGroup(groupId);
                return [2 /*return*/, Promise.resolve()];
            });
        });
    };
    StandaloneNetwork.prototype.deleteContact = function (contactId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                this.runtime.deleteContact(contactId);
                return [2 /*return*/, Promise.resolve()];
            });
        });
    };
    StandaloneNetwork.prototype.deleteWire = function (wireId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                this.runtime.deleteWire(wireId);
                return [2 /*return*/, Promise.resolve()];
            });
        });
    };
    StandaloneNetwork.prototype.listPrimitives = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, Promise.resolve(this.runtime.listPrimitives())];
            });
        });
    };
    StandaloneNetwork.prototype.terminate = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                if (this.changeInterval) {
                    clearInterval(this.changeInterval);
                    this.changeInterval = null;
                }
                return [2 /*return*/];
            });
        });
    };
    return StandaloneNetwork;
}(events_1.EventEmitter));
exports.StandaloneNetwork = StandaloneNetwork;
