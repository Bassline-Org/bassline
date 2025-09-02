import { bassline, bl, initializeBassline } from "./globals";

initializeBassline();

const { createNetwork, enterNetwork, network } = bassline();

const net = createNetwork('foo');
enterNetwork('foo', () => {
    console.log('entered network');
    console.log(network());
});

const otherNet = createNetwork('bar');
enterNetwork('bar', () => {
    console.log('entered network bar');
    console.log(network());
    enterNetwork('foo', () => {
        console.log('entered network foo from bar');
        console.log(network());
    });
});