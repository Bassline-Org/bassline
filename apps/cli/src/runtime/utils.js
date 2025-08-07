"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateId = generateId;
function generateId() {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
}
