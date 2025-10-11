#!/usr/bin/env node
import { WebSocketServer } from 'ws';
import { Evaluator } from './eval.js';
import { parse } from './parser.js';

const evaluator = new Evaluator();
const wss = new WebSocketServer({ port: 8080 });

wss.on('connection', (ws) => {
    console.log('Client connected');

    ws.on('message', async (data) => {
        const code = data.toString();

        try {
            const result = evaluator.run(parse(code));
            const finalResult = result instanceof Promise ? await result : result;

            // Send result back
            if (finalResult !== undefined) {
                ws.send(JSON.stringify({ result: finalResult }));
            } else {
                ws.send(JSON.stringify({ result: null }));
            }
        } catch (error) {
            ws.send(JSON.stringify({ error: error.message, stack: error.stack }));
        }
    });

    ws.on('close', () => {
        console.log('Client disconnected');
    });
});

console.log('Bassline daemon running on ws://localhost:8080');
console.log('Send Bassline code to evaluate...');
