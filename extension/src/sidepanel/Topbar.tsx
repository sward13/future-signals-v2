import type { ReactNode } from "react";
import { c } from "../../../src/styles/tokens.js";

type Props = { right?: ReactNode };

export function Topbar({ right }: Props) {
  return (
    <div
      style={{
        background: c.white,
        borderBottom: "0.5px solid rgba(0,0,0,0.09)",
        padding: "0 16px",
        height: 48,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexShrink: 0,
        boxSizing: "border-box",
      }}
    >
      <img
        src="./logo_light.svg"
        alt="Future Signals"
        style={{ width: 124, height: "auto", display: "block" }}
      />
      {right ?? null}
    </div>
  );
}
