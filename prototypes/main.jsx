import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import TextNodePrototype from "./text-node-prototype.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <TextNodePrototype />
  </StrictMode>
);
