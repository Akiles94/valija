import React from "react";
import { createRoot } from "react-dom/client";
import Spike from "./spike.js";

const root = document.getElementById("root");
if (!root) throw new Error("Root element not found");

createRoot(root).render(<Spike />);
