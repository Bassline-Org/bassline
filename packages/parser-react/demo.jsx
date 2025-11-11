import React from "react";
import ReactDOM from "react-dom/client";
import { LayeredControl } from "@bassline/parser/control";
import { LayeredControlProvider } from "./src/hooks/useLayeredControl.jsx";
import { LayeredControlDemo } from "./examples/LayeredControlDemo.jsx";

// Create a LayeredControl instance
const lc = new LayeredControl();

// Add a sample layer to start with
lc.addLayer("demo");

function App() {
    return (
        <LayeredControlProvider value={lc}>
            <LayeredControlDemo />
        </LayeredControlProvider>
    );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
