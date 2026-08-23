import { createRoot } from "react-dom/client";
import { Spike } from "./spike.js";

const root = document.getElementById("root");
if (!root) throw new Error("missing #root element");
createRoot(root).render(<Spike />);
