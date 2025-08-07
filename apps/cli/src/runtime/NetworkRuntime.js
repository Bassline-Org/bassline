"use strict";
// Minimal network runtime for CLI
// This reimplements core functionality without web dependencies
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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NetworkRuntime = void 0;
var events_1 = require("events");
var utils_js_1 = require("./utils.js");
var NetworkRuntime = /** @class */ (function (_super) {
    __extends(NetworkRuntime, _super);
    function NetworkRuntime() {
        var _this = _super.call(this) || this;
        _this.groups = new Map();
        _this.contacts = new Map();
        _this.wires = new Map();
        _this.changes = [];
        return _this;
    }
    NetworkRuntime.prototype.registerGroup = function (group) {
        this.groups.set(group.id, group);
        this.addChange('group-added', { group: group });
    };
    NetworkRuntime.prototype.addContact = function (groupId, contactData) {
        var _a;
        var contactId = contactData.id || (0, utils_js_1.generateId)();
        var contact = __assign({ id: contactId, content: (_a = contactData.content) !== null && _a !== void 0 ? _a : null, blendMode: contactData.blendMode || 'accept-last', groupId: groupId }, contactData);
        this.contacts.set(contactId, contact);
        // Add to group
        var group = this.groups.get(groupId);
        if (group) {
            group.contactIds.push(contactId);
        }
        this.addChange('contact-added', { contact: contact, groupId: groupId });
        return contactId;
    };
    NetworkRuntime.prototype.connect = function (fromId, toId, type) {
        if (type === void 0) { type = 'bidirectional'; }
        var wireId = (0, utils_js_1.generateId)();
        var wire = {
            id: wireId,
            fromId: fromId,
            toId: toId,
            type: type
        };
        this.wires.set(wireId, wire);
        // Find which group this wire belongs to
        var fromContact = this.contacts.get(fromId);
        var toContact = this.contacts.get(toId);
        if (fromContact && toContact) {
            // Determine wire's group
            var groupId = fromContact.groupId === toContact.groupId
                ? fromContact.groupId
                : fromContact.isBoundary ? toContact.groupId : fromContact.groupId;
            wire.groupId = groupId;
            var group = this.groups.get(groupId);
            if (group) {
                group.wireIds.push(wireId);
            }
        }
        this.addChange('wire-added', { wire: wire, groupId: wire.groupId });
        // Trigger propagation
        this.propagate(fromId);
        return wireId;
    };
    NetworkRuntime.prototype.scheduleUpdate = function (contactId, content) {
        var contact = this.contacts.get(contactId);
        if (contact && contact.content !== content) {
            contact.content = content;
            this.addChange('contact-updated', { contact: contact, contactId: contactId, groupId: contact.groupId, updates: { content: content } });
            this.propagate(contactId);
        }
    };
    NetworkRuntime.prototype.propagate = function (contactId) {
        var _this = this;
        // Simple immediate propagation
        var visited = new Set();
        var queue = [contactId];
        var _loop_1 = function () {
            var currentId = queue.shift();
            if (visited.has(currentId))
                return "continue";
            visited.add(currentId);
            var currentContact = this_1.contacts.get(currentId);
            if (!currentContact)
                return "continue";
            // Find connected contacts
            this_1.wires.forEach(function (wire) {
                var targetId = null;
                if (wire.fromId === currentId) {
                    targetId = wire.toId;
                }
                else if (wire.toId === currentId && wire.type === 'bidirectional') {
                    targetId = wire.fromId;
                }
                if (targetId && !visited.has(targetId)) {
                    var targetContact = _this.contacts.get(targetId);
                    if (targetContact) {
                        // Simple propagation - just copy value
                        if (targetContact.content !== currentContact.content) {
                            targetContact.content = currentContact.content;
                            _this.addChange('contact-updated', { contact: targetContact, contactId: targetId, groupId: targetContact.groupId, updates: { content: targetContact.content } });
                            queue.push(targetId);
                        }
                    }
                }
            });
        };
        var this_1 = this;
        while (queue.length > 0) {
            _loop_1();
        }
        // Check for primitive gadget execution
        this.checkPrimitiveExecution();
    };
    NetworkRuntime.prototype.checkPrimitiveExecution = function () {
        var _this = this;
        // Execute primitive gadgets
        this.groups.forEach(function (group) {
            if (group.primitiveId) {
                _this.executePrimitive(group);
            }
        });
    };
    NetworkRuntime.prototype.executePrimitive = function (group) {
        var _this = this;
        // Simple primitive execution
        var inputs = {};
        var outputs = {};
        // Gather boundary contacts
        group.boundaryContactIds.forEach(function (contactId) {
            var contact = _this.contacts.get(contactId);
            if (contact) {
                if (contact.boundaryDirection === 'input') {
                    inputs[contact.name || contactId] = contact.content;
                }
                else {
                    outputs[contact.name || contactId] = contact;
                }
            }
        });
        // Execute primitive
        var result = null;
        switch (group.primitiveId) {
            case 'add':
                if (inputs.a !== null && inputs.b !== null) {
                    result = inputs.a + inputs.b;
                    if (outputs.sum) {
                        this.scheduleUpdate(outputs.sum.id, result);
                    }
                }
                break;
            case 'multiply':
                if (inputs.a !== null && inputs.b !== null) {
                    result = inputs.a * inputs.b;
                    if (outputs.product) {
                        this.scheduleUpdate(outputs.product.id, result);
                    }
                }
                break;
            case 'concat':
                if (inputs.a !== null && inputs.b !== null) {
                    result = String(inputs.a) + String(inputs.b);
                    if (outputs.result) {
                        this.scheduleUpdate(outputs.result.id, result);
                    }
                }
                break;
            case 'gate':
                if (inputs.value !== null && inputs.gate !== null) {
                    if (inputs.gate) {
                        result = inputs.value;
                        if (outputs.output) {
                            this.scheduleUpdate(outputs.output.id, result);
                        }
                    }
                }
                break;
            case 'and':
                if (inputs.a !== null && inputs.b !== null) {
                    result = inputs.a && inputs.b;
                    if (outputs.result) {
                        this.scheduleUpdate(outputs.result.id, result);
                    }
                }
                break;
            case 'or':
                if (inputs.a !== null && inputs.b !== null) {
                    result = inputs.a || inputs.b;
                    if (outputs.result) {
                        this.scheduleUpdate(outputs.result.id, result);
                    }
                }
                break;
            case 'not':
                if (inputs.input !== null) {
                    result = !inputs.input;
                    if (outputs.result) {
                        this.scheduleUpdate(outputs.result.id, result);
                    }
                }
                break;
        }
    };
    NetworkRuntime.prototype.getState = function (groupId) {
        var _this = this;
        if (groupId === void 0) { groupId = 'root'; }
        var group = this.groups.get(groupId);
        if (!group) {
            throw new Error("Group ".concat(groupId, " not found"));
        }
        var contacts = new Map();
        var wires = new Map();
        // Get contacts in this group
        group.contactIds.forEach(function (contactId) {
            var contact = _this.contacts.get(contactId);
            if (contact) {
                contacts.set(contactId, contact);
            }
        });
        // Get wires in this group
        group.wireIds.forEach(function (wireId) {
            var wire = _this.wires.get(wireId);
            if (wire) {
                wires.set(wireId, wire);
            }
        });
        return { group: group, contacts: contacts, wires: wires };
    };
    NetworkRuntime.prototype.exportState = function (groupId) {
        var _this = this;
        var groups = {};
        var contacts = {};
        var wires = {};
        if (groupId) {
            // Export specific group and its contents
            var group = this.groups.get(groupId);
            if (group) {
                groups[groupId] = group;
                group.contactIds.forEach(function (id) {
                    var contact = _this.contacts.get(id);
                    if (contact)
                        contacts[id] = contact;
                });
                group.wireIds.forEach(function (id) {
                    var wire = _this.wires.get(id);
                    if (wire)
                        wires[id] = wire;
                });
            }
        }
        else {
            // Export everything
            this.groups.forEach(function (group, id) { return groups[id] = group; });
            this.contacts.forEach(function (contact, id) { return contacts[id] = contact; });
            this.wires.forEach(function (wire, id) { return wires[id] = wire; });
        }
        return { groups: groups, contacts: contacts, wires: wires };
    };
    NetworkRuntime.prototype.importState = function (state) {
        var _this = this;
        // Clear existing state
        this.groups.clear();
        this.contacts.clear();
        this.wires.clear();
        // Import groups
        if (state.groups) {
            Object.values(state.groups).forEach(function (group) {
                _this.groups.set(group.id, group);
            });
        }
        // Import contacts
        if (state.contacts) {
            Object.values(state.contacts).forEach(function (contact) {
                _this.contacts.set(contact.id, contact);
            });
        }
        // Import wires
        if (state.wires) {
            Object.values(state.wires).forEach(function (wire) {
                _this.wires.set(wire.id, wire);
            });
        }
        this.addChange('state-imported', { state: state });
    };
    NetworkRuntime.prototype.addChange = function (type, data) {
        this.changes.push({ type: type, data: data });
        this.emit('change', { type: type, data: data });
    };
    NetworkRuntime.prototype.getChanges = function () {
        var changes = __spreadArray([], this.changes, true);
        this.changes = [];
        return changes;
    };
    NetworkRuntime.prototype.listGroups = function () {
        var groups = [];
        this.groups.forEach(function (group) {
            groups.push({
                id: group.id,
                name: group.name,
                parentId: group.parentId,
                primitiveId: group.primitiveId,
                contactCount: group.contactIds.length,
                wireCount: group.wireIds.length,
                subgroupCount: group.subgroupIds.length
            });
        });
        return groups;
    };
    NetworkRuntime.prototype.createGroup = function (name, parentId, primitiveId) {
        var _this = this;
        if (parentId === void 0) { parentId = 'root'; }
        var groupId = (0, utils_js_1.generateId)();
        var group = {
            id: groupId,
            name: name,
            parentId: parentId,
            primitiveId: primitiveId,
            contactIds: [],
            wireIds: [],
            subgroupIds: [],
            boundaryContactIds: []
        };
        // If it's a primitive gadget, create boundary contacts
        if (primitiveId) {
            var primitiveInfo = this.getPrimitiveInfo(primitiveId);
            if (primitiveInfo) {
                // Create input boundary contacts
                primitiveInfo.inputs.forEach(function (input) {
                    var contactId = _this.addContact(groupId, {
                        name: input.name,
                        isBoundary: true,
                        boundaryDirection: 'input'
                    });
                    group.boundaryContactIds.push(contactId);
                });
                // Create output boundary contacts
                primitiveInfo.outputs.forEach(function (output) {
                    var contactId = _this.addContact(groupId, {
                        name: output.name,
                        isBoundary: true,
                        boundaryDirection: 'output'
                    });
                    group.boundaryContactIds.push(contactId);
                });
            }
        }
        this.groups.set(groupId, group);
        // Add to parent group
        var parent = this.groups.get(parentId);
        if (parent) {
            parent.subgroupIds.push(groupId);
        }
        this.addChange('group-created', { group: group, parentId: parentId });
        return groupId;
    };
    NetworkRuntime.prototype.deleteGroup = function (groupId) {
        var _this = this;
        var group = this.groups.get(groupId);
        if (!group)
            return;
        // Remove from parent
        if (group.parentId) {
            var parent_1 = this.groups.get(group.parentId);
            if (parent_1) {
                parent_1.subgroupIds = parent_1.subgroupIds.filter(function (id) { return id !== groupId; });
            }
        }
        // Delete all contacts in group
        group.contactIds.forEach(function (contactId) {
            _this.deleteContact(contactId);
        });
        // Delete all wires in group
        group.wireIds.forEach(function (wireId) {
            _this.deleteWire(wireId);
        });
        // Recursively delete subgroups
        group.subgroupIds.forEach(function (subgroupId) {
            _this.deleteGroup(subgroupId);
        });
        this.groups.delete(groupId);
        this.addChange('group-removed', { groupId: groupId });
    };
    NetworkRuntime.prototype.deleteContact = function (contactId) {
        var _this = this;
        var contact = this.contacts.get(contactId);
        if (!contact)
            return;
        // Remove from group
        var group = this.groups.get(contact.groupId);
        if (group) {
            group.contactIds = group.contactIds.filter(function (id) { return id !== contactId; });
            group.boundaryContactIds = group.boundaryContactIds.filter(function (id) { return id !== contactId; });
        }
        // Delete connected wires
        this.wires.forEach(function (wire) {
            if (wire.fromId === contactId || wire.toId === contactId) {
                _this.deleteWire(wire.id);
            }
        });
        this.contacts.delete(contactId);
        this.addChange('contact-removed', { contactId: contactId, groupId: contact.groupId });
    };
    NetworkRuntime.prototype.deleteWire = function (wireId) {
        var wire = this.wires.get(wireId);
        if (!wire)
            return;
        // Remove from group
        if (wire.groupId) {
            var group = this.groups.get(wire.groupId);
            if (group) {
                group.wireIds = group.wireIds.filter(function (id) { return id !== wireId; });
            }
        }
        this.wires.delete(wireId);
        this.addChange('wire-removed', { wireId: wireId, groupId: wire.groupId });
    };
    NetworkRuntime.prototype.listPrimitives = function () {
        return [
            {
                id: 'add',
                name: 'Add',
                description: 'Adds two numbers',
                inputs: [
                    { name: 'a', type: 'number', required: true },
                    { name: 'b', type: 'number', required: true }
                ],
                outputs: [
                    { name: 'sum', type: 'number' }
                ]
            },
            {
                id: 'multiply',
                name: 'Multiply',
                description: 'Multiplies two numbers',
                inputs: [
                    { name: 'a', type: 'number', required: true },
                    { name: 'b', type: 'number', required: true }
                ],
                outputs: [
                    { name: 'product', type: 'number' }
                ]
            },
            {
                id: 'concat',
                name: 'String Concat',
                description: 'Concatenates two strings',
                inputs: [
                    { name: 'a', type: 'string', required: true },
                    { name: 'b', type: 'string', required: true }
                ],
                outputs: [
                    { name: 'result', type: 'string' }
                ]
            },
            {
                id: 'gate',
                name: 'Gate',
                description: 'Passes value when gate is truthy',
                inputs: [
                    { name: 'value', type: 'any', required: true },
                    { name: 'gate', type: 'boolean', required: true }
                ],
                outputs: [
                    { name: 'output', type: 'any' }
                ]
            },
            {
                id: 'and',
                name: 'AND Gate',
                description: 'Logical AND operation',
                inputs: [
                    { name: 'a', type: 'boolean', required: true },
                    { name: 'b', type: 'boolean', required: true }
                ],
                outputs: [
                    { name: 'result', type: 'boolean' }
                ]
            },
            {
                id: 'or',
                name: 'OR Gate',
                description: 'Logical OR operation',
                inputs: [
                    { name: 'a', type: 'boolean', required: true },
                    { name: 'b', type: 'boolean', required: true }
                ],
                outputs: [
                    { name: 'result', type: 'boolean' }
                ]
            },
            {
                id: 'not',
                name: 'NOT Gate',
                description: 'Logical NOT operation',
                inputs: [
                    { name: 'input', type: 'boolean', required: true }
                ],
                outputs: [
                    { name: 'result', type: 'boolean' }
                ]
            }
        ];
    };
    NetworkRuntime.prototype.getPrimitiveInfo = function (primitiveId) {
        var primitives = this.listPrimitives();
        return primitives.find(function (p) { return p.id === primitiveId; });
    };
    return NetworkRuntime;
}(events_1.EventEmitter));
exports.NetworkRuntime = NetworkRuntime;
