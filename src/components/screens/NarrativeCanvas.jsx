/**
 * NarrativeCanvas screen — stub for Pass 1.
 */
import { c } from "../../styles/tokens.js";

export default function NarrativeCanvas({ appState }) {
  return (
    <div style={{ padding: "28px 32px", background: c.bg, minHeight: "100%" }}>
      <div style={{ fontSize: 22, fontWeight: 500, color: c.ink, marginBottom: 8 }}>Narrative canvas</div>
      <div style={{ fontSize: 13, color: c.muted }}>Coming in Pass 2.</div>
    </div>
  );
}
