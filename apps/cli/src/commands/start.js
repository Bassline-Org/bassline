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
exports.startServer = startServer;
var chalk_1 = require("chalk");
var ora_1 = require("ora");
var http_1 = require("http");
var os_1 = require("os");
var ws_1 = require("ws");
var StandaloneNetwork_js_1 = require("../runtime/StandaloneNetwork.js");
function startServer(options) {
    return __awaiter(this, void 0, void 0, function () {
        var spinner, network_1, server_1, wss, wsClients_1, host_1, error_1;
        var _this = this;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    spinner = (0, ora_1.default)('Starting propagation network server...').start();
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 4, , 5]);
                    network_1 = new StandaloneNetwork_js_1.StandaloneNetwork();
                    return [4 /*yield*/, network_1.initialize('immediate')
                        // Create root group
                    ];
                case 2:
                    _a.sent();
                    // Create root group
                    return [4 /*yield*/, network_1.registerGroup({
                            id: 'root',
                            name: 'Root Group',
                            contactIds: [],
                            wireIds: [],
                            subgroupIds: [],
                            boundaryContactIds: []
                        })
                        // Create HTTP server for network API
                    ];
                case 3:
                    // Create root group
                    _a.sent();
                    server_1 = http_1.default.createServer(function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                        var body;
                        var _this = this;
                        return __generator(this, function (_a) {
                            res.setHeader('Content-Type', 'application/json');
                            res.setHeader('Access-Control-Allow-Origin', '*');
                            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
                            res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
                            if (req.method === 'OPTIONS') {
                                res.writeHead(200);
                                res.end();
                                return [2 /*return*/];
                            }
                            body = '';
                            req.on('data', function (chunk) { return body += chunk; });
                            req.on('end', function () { return __awaiter(_this, void 0, void 0, function () {
                                var url, groupId, state, serializedState, groups, _a, name_1, parentId, primitiveId, groupId, groupId, primitives, _b, groupId, contact, contactId, contactId, _c, fromId, toId, type, wireId, wireId, _d, contactId, content, error_2;
                                return __generator(this, function (_e) {
                                    switch (_e.label) {
                                        case 0:
                                            _e.trys.push([0, 22, , 23]);
                                            url = new URL(req.url, "http://localhost:".concat(options.port));
                                            if (!(url.pathname === '/state' && req.method === 'GET')) return [3 /*break*/, 2];
                                            groupId = url.searchParams.get('groupId') || 'root';
                                            return [4 /*yield*/, network_1.getState(groupId)
                                                // Convert Maps to objects for JSON serialization
                                            ];
                                        case 1:
                                            state = _e.sent();
                                            serializedState = {
                                                group: state.group,
                                                contacts: Object.fromEntries(state.contacts),
                                                wires: Object.fromEntries(state.wires)
                                            };
                                            res.writeHead(200);
                                            res.end(JSON.stringify(serializedState));
                                            return [3 /*break*/, 21];
                                        case 2:
                                            if (!(url.pathname === '/groups' && req.method === 'GET')) return [3 /*break*/, 4];
                                            return [4 /*yield*/, network_1.listGroups()];
                                        case 3:
                                            groups = _e.sent();
                                            res.writeHead(200);
                                            res.end(JSON.stringify(groups));
                                            return [3 /*break*/, 21];
                                        case 4:
                                            if (!(url.pathname === '/groups' && req.method === 'POST')) return [3 /*break*/, 6];
                                            _a = JSON.parse(body), name_1 = _a.name, parentId = _a.parentId, primitiveId = _a.primitiveId;
                                            return [4 /*yield*/, network_1.createGroup(name_1, parentId, primitiveId)];
                                        case 5:
                                            groupId = _e.sent();
                                            res.writeHead(200);
                                            res.end(JSON.stringify({ groupId: groupId }));
                                            return [3 /*break*/, 21];
                                        case 6:
                                            if (!(url.pathname.match(/^\/groups\/[^\/]+$/) && req.method === 'DELETE')) return [3 /*break*/, 8];
                                            groupId = url.pathname.split('/')[2];
                                            return [4 /*yield*/, network_1.deleteGroup(groupId)];
                                        case 7:
                                            _e.sent();
                                            res.writeHead(200);
                                            res.end(JSON.stringify({ success: true }));
                                            return [3 /*break*/, 21];
                                        case 8:
                                            if (!(url.pathname === '/primitives' && req.method === 'GET')) return [3 /*break*/, 10];
                                            return [4 /*yield*/, network_1.listPrimitives()];
                                        case 9:
                                            primitives = _e.sent();
                                            res.writeHead(200);
                                            res.end(JSON.stringify(primitives));
                                            return [3 /*break*/, 21];
                                        case 10:
                                            if (!(url.pathname === '/contact' && req.method === 'POST')) return [3 /*break*/, 12];
                                            _b = JSON.parse(body), groupId = _b.groupId, contact = _b.contact;
                                            return [4 /*yield*/, network_1.addContact(groupId, contact)];
                                        case 11:
                                            contactId = _e.sent();
                                            res.writeHead(200);
                                            res.end(JSON.stringify({ contactId: contactId }));
                                            return [3 /*break*/, 21];
                                        case 12:
                                            if (!(url.pathname.match(/^\/contact\/[^\/]+$/) && req.method === 'DELETE')) return [3 /*break*/, 14];
                                            contactId = url.pathname.split('/')[2];
                                            return [4 /*yield*/, network_1.deleteContact(contactId)];
                                        case 13:
                                            _e.sent();
                                            res.writeHead(200);
                                            res.end(JSON.stringify({ success: true }));
                                            return [3 /*break*/, 21];
                                        case 14:
                                            if (!(url.pathname === '/connect' && req.method === 'POST')) return [3 /*break*/, 16];
                                            _c = JSON.parse(body), fromId = _c.fromId, toId = _c.toId, type = _c.type;
                                            return [4 /*yield*/, network_1.connect(fromId, toId, type)];
                                        case 15:
                                            wireId = _e.sent();
                                            res.writeHead(200);
                                            res.end(JSON.stringify({ wireId: wireId }));
                                            return [3 /*break*/, 21];
                                        case 16:
                                            if (!(url.pathname.match(/^\/wire\/[^\/]+$/) && req.method === 'DELETE')) return [3 /*break*/, 18];
                                            wireId = url.pathname.split('/')[2];
                                            return [4 /*yield*/, network_1.deleteWire(wireId)];
                                        case 17:
                                            _e.sent();
                                            res.writeHead(200);
                                            res.end(JSON.stringify({ success: true }));
                                            return [3 /*break*/, 21];
                                        case 18:
                                            if (!(url.pathname === '/update' && req.method === 'POST')) return [3 /*break*/, 20];
                                            _d = JSON.parse(body), contactId = _d.contactId, content = _d.content;
                                            return [4 /*yield*/, network_1.scheduleUpdate(contactId, content)];
                                        case 19:
                                            _e.sent();
                                            res.writeHead(200);
                                            res.end(JSON.stringify({ success: true }));
                                            return [3 /*break*/, 21];
                                        case 20:
                                            res.writeHead(404);
                                            res.end(JSON.stringify({ error: 'Not found' }));
                                            _e.label = 21;
                                        case 21: return [3 /*break*/, 23];
                                        case 22:
                                            error_2 = _e.sent();
                                            res.writeHead(500);
                                            res.end(JSON.stringify({ error: error_2.message }));
                                            return [3 /*break*/, 23];
                                        case 23: return [2 /*return*/];
                                    }
                                });
                            }); });
                            return [2 /*return*/];
                        });
                    }); });
                    wss = new ws_1.WebSocketServer({ server: server_1 });
                    wsClients_1 = new Map() // ws -> Set of subscribed groupIds
                    ;
                    wss.on('connection', function (ws) {
                        console.log(chalk_1.default.blue('WebSocket client connected'));
                        wsClients_1.set(ws, new Set());
                        ws.on('message', function (data) { return __awaiter(_this, void 0, void 0, function () {
                            var message, responseData, _a, state, contactId, wireId, groupId, error_3, groupId_1, subscriptions, unsubGroupIds, subs_1, error_4;
                            var _this = this;
                            return __generator(this, function (_b) {
                                switch (_b.label) {
                                    case 0:
                                        console.log(chalk_1.default.gray('[WebSocket] Received message:', data.toString()));
                                        _b.label = 1;
                                    case 1:
                                        _b.trys.push([1, 28, , 29]);
                                        message = JSON.parse(data.toString());
                                        if (!message.requestId) return [3 /*break*/, 27];
                                        console.log(chalk_1.default.cyan("[WebSocket] Request ".concat(message.requestId, ": ").concat(message.type)));
                                        _b.label = 2;
                                    case 2:
                                        _b.trys.push([2, 25, , 26]);
                                        responseData = void 0;
                                        _a = message.type;
                                        switch (_a) {
                                            case 'get-state': return [3 /*break*/, 3];
                                            case 'add-contact': return [3 /*break*/, 5];
                                            case 'update-contact': return [3 /*break*/, 7];
                                            case 'remove-contact': return [3 /*break*/, 9];
                                            case 'add-wire': return [3 /*break*/, 11];
                                            case 'remove-wire': return [3 /*break*/, 13];
                                            case 'add-group': return [3 /*break*/, 15];
                                            case 'remove-group': return [3 /*break*/, 17];
                                            case 'list-groups': return [3 /*break*/, 19];
                                            case 'list-primitives': return [3 /*break*/, 21];
                                        }
                                        return [3 /*break*/, 23];
                                    case 3: return [4 /*yield*/, network_1.getState(message.groupId || 'root')];
                                    case 4:
                                        state = _b.sent();
                                        responseData = {
                                            group: state.group,
                                            contacts: Object.fromEntries(state.contacts),
                                            wires: Object.fromEntries(state.wires)
                                        };
                                        return [3 /*break*/, 24];
                                    case 5: return [4 /*yield*/, network_1.addContact(message.groupId, message.contact)];
                                    case 6:
                                        contactId = _b.sent();
                                        responseData = { contactId: contactId };
                                        return [3 /*break*/, 24];
                                    case 7: return [4 /*yield*/, network_1.scheduleUpdate(message.contactId, message.content)];
                                    case 8:
                                        _b.sent();
                                        responseData = { success: true };
                                        return [3 /*break*/, 24];
                                    case 9: return [4 /*yield*/, network_1.deleteContact(message.contactId)];
                                    case 10:
                                        _b.sent();
                                        responseData = { success: true };
                                        return [3 /*break*/, 24];
                                    case 11: return [4 /*yield*/, network_1.connect(message.fromId, message.toId, message.wireType)];
                                    case 12:
                                        wireId = _b.sent();
                                        responseData = { wireId: wireId };
                                        return [3 /*break*/, 24];
                                    case 13: return [4 /*yield*/, network_1.deleteWire(message.wireId)];
                                    case 14:
                                        _b.sent();
                                        responseData = { success: true };
                                        return [3 /*break*/, 24];
                                    case 15: return [4 /*yield*/, network_1.createGroup(message.name, message.parentId, message.primitiveId)];
                                    case 16:
                                        groupId = _b.sent();
                                        responseData = { groupId: groupId };
                                        return [3 /*break*/, 24];
                                    case 17: return [4 /*yield*/, network_1.deleteGroup(message.groupId)];
                                    case 18:
                                        _b.sent();
                                        responseData = { success: true };
                                        return [3 /*break*/, 24];
                                    case 19: return [4 /*yield*/, network_1.listGroups()];
                                    case 20:
                                        responseData = _b.sent();
                                        return [3 /*break*/, 24];
                                    case 21: return [4 /*yield*/, network_1.listPrimitives()];
                                    case 22:
                                        responseData = _b.sent();
                                        return [3 /*break*/, 24];
                                    case 23: throw new Error("Unknown request type: ".concat(message.type));
                                    case 24:
                                        ws.send(JSON.stringify({
                                            requestId: message.requestId,
                                            data: responseData
                                        }));
                                        return [3 /*break*/, 26];
                                    case 25:
                                        error_3 = _b.sent();
                                        ws.send(JSON.stringify({
                                            requestId: message.requestId,
                                            error: error_3.message
                                        }));
                                        return [3 /*break*/, 26];
                                    case 26: return [2 /*return*/];
                                    case 27:
                                        // Handle subscription messages
                                        switch (message.type) {
                                            case 'subscribe':
                                                groupId_1 = message.groupId || 'root';
                                                console.log(chalk_1.default.green("[WebSocket] Client subscribing to group: ".concat(groupId_1)));
                                                subscriptions = wsClients_1.get(ws);
                                                subscriptions.add(groupId_1);
                                                // Send initial state for subscribed group
                                                (function () { return __awaiter(_this, void 0, void 0, function () {
                                                    var state, serializedState, error_5;
                                                    return __generator(this, function (_a) {
                                                        switch (_a.label) {
                                                            case 0:
                                                                _a.trys.push([0, 2, , 3]);
                                                                return [4 /*yield*/, network_1.getState(groupId_1)];
                                                            case 1:
                                                                state = _a.sent();
                                                                serializedState = {
                                                                    group: state.group,
                                                                    contacts: Object.fromEntries(state.contacts),
                                                                    wires: Object.fromEntries(state.wires)
                                                                };
                                                                console.log(chalk_1.default.blue("[WebSocket] Sending initial state for group: ".concat(groupId_1)));
                                                                ws.send(JSON.stringify({
                                                                    type: 'state-update',
                                                                    groupId: groupId_1,
                                                                    state: serializedState
                                                                }));
                                                                return [3 /*break*/, 3];
                                                            case 2:
                                                                error_5 = _a.sent();
                                                                ws.send(JSON.stringify({
                                                                    type: 'error',
                                                                    error: error_5.message
                                                                }));
                                                                return [3 /*break*/, 3];
                                                            case 3: return [2 /*return*/];
                                                        }
                                                    });
                                                }); })();
                                                break;
                                            case 'unsubscribe':
                                                unsubGroupIds = message.groupIds || [message.groupId];
                                                subs_1 = wsClients_1.get(ws);
                                                unsubGroupIds.forEach(function (id) { return subs_1.delete(id); });
                                                break;
                                        }
                                        return [3 /*break*/, 29];
                                    case 28:
                                        error_4 = _b.sent();
                                        console.error('WebSocket message error:', error_4);
                                        return [3 /*break*/, 29];
                                    case 29: return [2 /*return*/];
                                }
                            });
                        }); });
                        ws.on('close', function () {
                            console.log(chalk_1.default.yellow('WebSocket client disconnected'));
                            wsClients_1.delete(ws);
                        });
                        ws.on('error', function (error) {
                            console.error('WebSocket error:', error);
                            wsClients_1.delete(ws);
                        });
                    });
                    host_1 = options.host || '0.0.0.0' // Default to all interfaces
                    ;
                    server_1.listen(parseInt(options.port), host_1, function () {
                        spinner.succeed(chalk_1.default.green("Network server running on ".concat(host_1, ":").concat(options.port)));
                        console.log(chalk_1.default.blue("\nNetwork: ".concat(options.name)));
                        // Show connection URLs
                        if (host_1 === '0.0.0.0') {
                            console.log(chalk_1.default.gray("\nLocal connections:"));
                            console.log(chalk_1.default.gray("  HTTP: http://localhost:".concat(options.port)));
                            console.log(chalk_1.default.gray("  WebSocket: ws://localhost:".concat(options.port)));
                            // Get local network IP
                            var interfaces = os_1.default.networkInterfaces();
                            var addresses = [];
                            for (var _i = 0, _a = Object.keys(interfaces); _i < _a.length; _i++) {
                                var name_2 = _a[_i];
                                for (var _b = 0, _c = interfaces[name_2]; _b < _c.length; _b++) {
                                    var iface = _c[_b];
                                    if (iface.family === 'IPv4' && !iface.internal) {
                                        addresses.push(iface.address);
                                    }
                                }
                            }
                            if (addresses.length > 0) {
                                console.log(chalk_1.default.gray("\nNetwork connections (for other devices):"));
                                addresses.forEach(function (addr) {
                                    console.log(chalk_1.default.yellow("  HTTP: http://".concat(addr, ":").concat(options.port)));
                                    console.log(chalk_1.default.yellow("  WebSocket: ws://".concat(addr, ":").concat(options.port)));
                                });
                            }
                        }
                        else {
                            console.log(chalk_1.default.gray("HTTP API: http://".concat(host_1, ":").concat(options.port)));
                            console.log(chalk_1.default.gray("WebSocket: ws://".concat(host_1, ":").concat(options.port)));
                        }
                        console.log(chalk_1.default.gray('\nEndpoints:'));
                        console.log(chalk_1.default.gray('  GET  /state?groupId=<id>    - Get group state'));
                        console.log(chalk_1.default.gray('  GET  /groups               - List all groups'));
                        console.log(chalk_1.default.gray('  POST /groups               - Create new group'));
                        console.log(chalk_1.default.gray('  DELETE /groups/<id>        - Delete group'));
                        console.log(chalk_1.default.gray('  GET  /primitives           - List available primitives'));
                        console.log(chalk_1.default.gray('  POST /contact              - Add contact'));
                        console.log(chalk_1.default.gray('  DELETE /contact/<id>       - Delete contact'));
                        console.log(chalk_1.default.gray('  POST /connect              - Create wire'));
                        console.log(chalk_1.default.gray('  DELETE /wire/<id>          - Delete wire'));
                        console.log(chalk_1.default.gray('  POST /update               - Update contact'));
                        console.log(chalk_1.default.gray('\nPress Ctrl+C to stop'));
                    });
                    // Subscribe to changes and broadcast to WebSocket clients
                    network_1.subscribe(function (changes) {
                        changes.forEach(function (change) {
                            console.log(chalk_1.default.yellow("[Change] ".concat(change.type, ":")), change.data);
                            // Broadcast to relevant WebSocket clients
                            wsClients_1.forEach(function (subscribedGroups, ws) {
                                var _a;
                                // Determine which groups are affected by this change
                                var affectedGroupId = null;
                                switch (change.type) {
                                    case 'contact-added':
                                    case 'contact-updated':
                                    case 'contact-removed':
                                    case 'wire-added':
                                    case 'wire-removed':
                                        affectedGroupId = change.data.groupId;
                                        break;
                                    case 'group-added':
                                        affectedGroupId = ((_a = change.data.group) === null || _a === void 0 ? void 0 : _a.parentId) || 'root';
                                        break;
                                    case 'group-updated':
                                    case 'group-removed':
                                        affectedGroupId = change.data.groupId;
                                        break;
                                }
                                // If this client is subscribed to the affected group, send the change
                                if (affectedGroupId && subscribedGroups.has(affectedGroupId)) {
                                    console.log(chalk_1.default.magenta("[WebSocket] Broadcasting ".concat(change.type, " to client for group: ").concat(affectedGroupId)));
                                    ws.send(JSON.stringify({
                                        type: 'change',
                                        groupId: affectedGroupId,
                                        change: change
                                    }));
                                }
                                else if (affectedGroupId) {
                                    console.log(chalk_1.default.gray("[WebSocket] Client not subscribed to group ".concat(affectedGroupId, ", skipping broadcast")));
                                }
                            });
                        });
                    });
                    // Handle shutdown
                    process.on('SIGINT', function () { return __awaiter(_this, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    console.log(chalk_1.default.yellow('\nShutting down...'));
                                    server_1.close();
                                    return [4 /*yield*/, network_1.terminate()];
                                case 1:
                                    _a.sent();
                                    process.exit(0);
                                    return [2 /*return*/];
                            }
                        });
                    }); });
                    return [3 /*break*/, 5];
                case 4:
                    error_1 = _a.sent();
                    spinner.fail(chalk_1.default.red('Failed to start server'));
                    console.error(error_1);
                    process.exit(1);
                    return [3 /*break*/, 5];
                case 5: return [2 /*return*/];
            }
        });
    });
}
