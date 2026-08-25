import { createRoot } from "react-dom/client";
import { App } from "./app.js";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/screens.css";

const root = document.getElementById("root");
if (!root) throw new Error("missing #root element");
createRoot(root).render(<App />);
