const ws = new WebSocket("ws://localhost:8080");
ws.addEventListener("message", (event) => {
    console.log("Event:", event);
    console.log("Received:", event.data);
});
ws.addEventListener("open", () => {
    console.log("Open");
    ws.send("words system");
});
ws.addEventListener("error", (event) => {
    console.error("Error:", event);
});
ws.addEventListener("close", () => {
    console.log("Closed");
});
