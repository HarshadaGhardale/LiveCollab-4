import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Polyfill Node.js globals for simple-peer
import { Buffer } from "buffer";
// @ts-ignore
window.global = window;
// @ts-ignore
window.process = window.process || {};
// @ts-ignore
window.process.nextTick = function (cb) {
    setTimeout(cb, 0);
};
// @ts-ignore
window.process.env = window.process.env || {};
// @ts-ignore
window.Buffer = Buffer;

createRoot(document.getElementById("root")!).render(<App />);
