import { WebSocketServer } from "ws";

const server = new WebSocketServer({ port: 8080 });

server.on("connection", async (socket) => {
    socket.on("message", (message) => {
        console.log("message:", message.toString());
    });
    socket.on("error", (error) => {
        console.error("WebSocket client error:", error);
    });
    socket.on("close", () => {
        console.log("Websocket closed");
    });
    console.log("New client connected");
    socket.send('print "Welcome to the server"');
    await new Promise((resolve) => setTimeout(resolve, 1000));
    socket.send('print "something else"');
    await new Promise((resolve) => setTimeout(resolve, 1000));
    socket.send("send value");
});

server.on("error", (error) => {
    console.error("WebSocket server error:", error);
});

server.on("listening", () => {
    console.log("WebSocket server is listening on port 8080");
});
