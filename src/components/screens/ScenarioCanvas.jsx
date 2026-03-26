/**
 * ScenarioCanvas screen — stub (renders the Systems screen heading).
 */
import { c } from "../../styles/tokens.js";

export default function ScenarioCanvas({ appState }) {
  return (
    <div style={{ padding: "28px 32px", background: c.bg, minHeight: "100%" }}>
      <div style={{ fontSize: 22, fontWeight: 500, color: c.ink, marginBottom: 8 }}>Systems</div>
      <div style={{ fontSize: 13, color: c.muted }}>Coming next — build systems from your clusters.</div>
    </div>
  );
}
