"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
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
exports.createSignalCommand = createSignalCommand;
var commander_1 = require("commander");
var ws_1 = require("ws");
var http_1 = require("http");
var os_1 = require("os");
function createSignalCommand() {
    var _this = this;
    var command = new commander_1.Command('signal')
        .description('Start a WebRTC signaling server')
        .option('-p, --port <port>', 'Port to listen on', '8081')
        .option('--host <host>', 'Host to bind to', '0.0.0.0')
        .action(function (options) { return __awaiter(_this, void 0, void 0, function () {
        var rooms, connections, server, wss, port, host;
        return __generator(this, function (_a) {
            rooms = new Map();
            connections = new Map();
            server = http_1.default.createServer();
            wss = new ws_1.WebSocketServer({ server: server });
            wss.on('connection', function (ws) {
                var peerId = generatePeerId();
                var connection = { ws: ws, peerId: peerId };
                connections.set(peerId, connection);
                console.log("[Signal] Peer connected: ".concat(peerId));
                ws.on('message', function (data) {
                    try {
                        var message = JSON.parse(data.toString());
                        handleMessage(connection, message, rooms, connections);
                    }
                    catch (error) {
                        console.error('[Signal] Error handling message:', error);
                        ws.send(JSON.stringify({
                            type: 'error',
                            error: 'Invalid message format'
                        }));
                    }
                });
                ws.on('close', function () {
                    console.log("[Signal] Peer disconnected: ".concat(peerId));
                    // Clean up room membership
                    if (connection.roomCode) {
                        var room = rooms.get(connection.roomCode);
                        if (room) {
                            if (room.host === peerId) {
                                // Host left - notify all guests
                                room.guests.forEach(function (guestId) {
                                    var guest = connections.get(guestId);
                                    if (guest) {
                                        guest.ws.send(JSON.stringify({
                                            type: 'peer-left',
                                            peerId: peerId,
                                            isHost: true
                                        }));
                                    }
                                });
                                // Optionally migrate host to first guest
                                if (room.guests.size > 0) {
                                    var newHost = Array.from(room.guests)[0];
                                    room.host = newHost;
                                    room.guests.delete(newHost);
                                    // Notify new host
                                    var newHostConn = connections.get(newHost);
                                    if (newHostConn) {
                                        newHostConn.ws.send(JSON.stringify({
                                            type: 'host-migrated',
                                            newHost: newHost
                                        }));
                                    }
                                }
                                else {
                                    // No guests left, delete room
                                    rooms.delete(connection.roomCode);
                                }
                            }
                            else {
                                // Guest left - notify host and other guests
                                room.guests.delete(peerId);
                                // Notify host
                                if (room.host) {
                                    var host_1 = connections.get(room.host);
                                    if (host_1) {
                                        host_1.ws.send(JSON.stringify({
                                            type: 'peer-left',
                                            peerId: peerId
                                        }));
                                    }
                                }
                                // Notify other guests
                                room.guests.forEach(function (guestId) {
                                    var guest = connections.get(guestId);
                                    if (guest) {
                                        guest.ws.send(JSON.stringify({
                                            type: 'peer-left',
                                            peerId: peerId
                                        }));
                                    }
                                });
                            }
                        }
                    }
                    connections.delete(peerId);
                });
                ws.on('error', function (error) {
                    console.error("[Signal] WebSocket error for ".concat(peerId, ":"), error);
                });
            });
            port = parseInt(options.port);
            host = options.host;
            server.listen(port, host, function () {
                console.log("[Signal] WebRTC signaling server running on ws://".concat(host, ":").concat(port));
                // Also show local network addresses
                if (host === '0.0.0.0') {
                    var interfaces_1 = os_1.default.networkInterfaces();
                    Object.keys(interfaces_1).forEach(function (name) {
                        var _a;
                        (_a = interfaces_1[name]) === null || _a === void 0 ? void 0 : _a.forEach(function (iface) {
                            if (iface.family === 'IPv4' && !iface.internal) {
                                console.log("[Signal] Available at ws://".concat(iface.address, ":").concat(port));
                            }
                        });
                    });
                }
            });
            // Clean up old rooms periodically
            setInterval(function () {
                var now = Date.now();
                var timeout = 60 * 60 * 1000; // 1 hour
                for (var _i = 0, _a = rooms.entries(); _i < _a.length; _i++) {
                    var _b = _a[_i], code = _b[0], room = _b[1];
                    if (now - room.createdAt > timeout && room.guests.size === 0) {
                        console.log("[Signal] Cleaning up inactive room: ".concat(code));
                        rooms.delete(code);
                    }
                }
            }, 60 * 1000); // Check every minute
            return [2 /*return*/];
        });
    }); });
    return command;
}
function handleMessage(connection, message, rooms, connections) {
    console.log("[Signal] Message from ".concat(connection.peerId, ":"), message.type);
    switch (message.type) {
        case 'create-room':
            handleCreateRoom(connection, message, rooms, connections);
            break;
        case 'join-room':
            handleJoinRoom(connection, message, rooms, connections);
            break;
        case 'leave-room':
            handleLeaveRoom(connection, message, rooms);
            break;
        case 'offer':
        case 'answer':
        case 'ice-candidate':
            handleSignaling(connection, message, rooms, connections);
            break;
        default:
            connection.ws.send(JSON.stringify({
                type: 'error',
                error: "Unknown message type: ".concat(message.type)
            }));
    }
}
function handleCreateRoom(connection, message, rooms, connections) {
    var roomCode = message.roomCode || generateRoomCode();
    // Check if room already exists
    if (rooms.has(roomCode)) {
        connection.ws.send(JSON.stringify({
            type: 'error',
            error: 'Room already exists'
        }));
        return;
    }
    // Create room
    var room = {
        code: roomCode,
        host: connection.peerId,
        guests: new Set(),
        createdAt: Date.now()
    };
    rooms.set(roomCode, room);
    connection.roomCode = roomCode;
    console.log("[Signal] Room created: ".concat(roomCode, " by ").concat(connection.peerId));
    connection.ws.send(JSON.stringify({
        type: 'room-created',
        roomCode: roomCode,
        peerId: connection.peerId
    }));
}
function handleJoinRoom(connection, message, rooms, connections) {
    var roomCode = message.roomCode;
    if (!roomCode) {
        connection.ws.send(JSON.stringify({
            type: 'error',
            error: 'Room code required'
        }));
        return;
    }
    var room = rooms.get(roomCode);
    if (!room) {
        connection.ws.send(JSON.stringify({
            type: 'error',
            error: 'Room not found'
        }));
        return;
    }
    // Add guest to room
    room.guests.add(connection.peerId);
    connection.roomCode = roomCode;
    console.log("[Signal] ".concat(connection.peerId, " joined room ").concat(roomCode));
    // Send room-joined to the guest
    connection.ws.send(JSON.stringify({
        type: 'room-joined',
        roomCode: roomCode,
        hostId: room.host,
        guests: Array.from(room.guests)
    }));
    // Notify host that a guest joined
    if (room.host) {
        var host = connections.get(room.host);
        if (host) {
            host.ws.send(JSON.stringify({
                type: 'peer-joined',
                peerId: connection.peerId,
                roomCode: roomCode
            }));
        }
    }
    // Notify other guests
    room.guests.forEach(function (guestId) {
        if (guestId !== connection.peerId) {
            var guest = connections.get(guestId);
            if (guest) {
                guest.ws.send(JSON.stringify({
                    type: 'peer-joined',
                    peerId: connection.peerId,
                    roomCode: roomCode
                }));
            }
        }
    });
    // Send peer-joined for host to the new guest
    if (room.host) {
        connection.ws.send(JSON.stringify({
            type: 'peer-joined',
            peerId: room.host,
            roomCode: roomCode,
            data: { isHost: true }
        }));
    }
    // Send peer-joined for each existing guest to the new guest
    room.guests.forEach(function (guestId) {
        if (guestId !== connection.peerId) {
            connection.ws.send(JSON.stringify({
                type: 'peer-joined',
                peerId: guestId,
                roomCode: roomCode
            }));
        }
    });
}
function handleLeaveRoom(connection, message, rooms) {
    if (!connection.roomCode) {
        return;
    }
    var room = rooms.get(connection.roomCode);
    if (!room) {
        return;
    }
    // Remove from room
    if (room.host === connection.peerId) {
        room.host = null;
    }
    else {
        room.guests.delete(connection.peerId);
    }
    connection.roomCode = undefined;
    console.log("[Signal] ".concat(connection.peerId, " left room ").concat(room.code));
}
function handleSignaling(connection, message, rooms, connections) {
    if (!connection.roomCode) {
        connection.ws.send(JSON.stringify({
            type: 'error',
            error: 'Not in a room'
        }));
        return;
    }
    var room = rooms.get(connection.roomCode);
    if (!room) {
        return;
    }
    // If a specific target is provided, only forward to that peer
    // Otherwise forward to all peers in room
    var targetPeers = [];
    if (message.targetPeerId) {
        // Direct message to specific peer
        targetPeers = [message.targetPeerId];
    }
    else {
        // Broadcast to all other peers in room
        if (room.host && room.host !== connection.peerId) {
            targetPeers.push(room.host);
        }
        room.guests.forEach(function (guestId) {
            if (guestId !== connection.peerId) {
                targetPeers.push(guestId);
            }
        });
    }
    console.log("[Signal] Forwarding ".concat(message.type, " from ").concat(connection.peerId, " to ").concat(targetPeers.length, " peers"));
    targetPeers.forEach(function (targetId) {
        var target = connections.get(targetId);
        if (target) {
            target.ws.send(JSON.stringify(__assign(__assign({}, message), { peerId: connection.peerId, roomCode: connection.roomCode })));
        }
    });
}
function generatePeerId() {
    return Math.random().toString(36).substring(2, 15);
}
function generateRoomCode() {
    var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    var code = '';
    for (var i = 0; i < 6; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
}
