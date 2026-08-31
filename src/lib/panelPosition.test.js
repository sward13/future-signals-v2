import { test } from "node:test";
import assert from "node:assert/strict";

import { computeFlipPosition } from "./panelPosition.js";

// window is a jsdom-free browser global in this repo's tests — stub the two
// properties this module reads, matching how other tests in this codebase
// avoid pulling in a DOM.
function withViewport(width, height, fn) {
  const original = globalThis.window;
  globalThis.window = { innerWidth: width, innerHeight: height };
  try {
    fn();
  } finally {
    globalThis.window = original;
  }
}

const rect = (top, bottom, left, right) => ({ top, bottom, left, right });

// ─── Absent anchor ────────────────────────────────────────────────────────────

test("returns null when anchorRect is absent (mirrors every call site's anchorRect && guard)", () => {
  withViewport(1200, 800, () => {
    assert.equal(computeFlipPosition(null, { panelHeight: 280 }), null);
    assert.equal(computeFlipPosition(undefined, { panelHeight: 280 }), null);
  });
});

// ─── preferredDirection: "down" (ClusterAssignMenu / AddToProjectButton / ProjectDetail's menus) ──

test("down-preferred: stays down when there's enough room below", () => {
  withViewport(1200, 800, () => {
    // anchor near the top: bottom=100, plenty of the 800px-tall viewport left below
    const pos = computeFlipPosition(rect(80, 100, 900, 1000), { panelHeight: 280 });
    assert.deepEqual(pos, { position: "fixed", top: 104, right: 200 });
  });
});

test("down-preferred: flips up when there's not enough room below", () => {
  withViewport(1200, 800, () => {
    // anchor near the bottom: bottom=700, only 100px left below (< 280+48=328)
    const pos = computeFlipPosition(rect(680, 700, 900, 1000), { panelHeight: 280 });
    assert.deepEqual(pos, { position: "fixed", bottom: 124, right: 200 });
  });
});

test("down-preferred: the exact boundary (spaceBelow === threshold) stays down, not flips", () => {
  withViewport(1200, 800, () => {
    // spaceBelow = 800 - 472 = 328 = panelHeight(280) + buffer(48) exactly
    const pos = computeFlipPosition(rect(400, 472, 0, 0), { panelHeight: 280 });
    assert.ok("top" in pos, "boundary case should stay down (>= threshold means enough room)");
  });
});

test("down-preferred: one pixel short of the boundary flips up", () => {
  withViewport(1200, 800, () => {
    // spaceBelow = 800 - 473 = 327, one less than the 328 threshold
    const pos = computeFlipPosition(rect(400, 473, 0, 0), { panelHeight: 280 });
    assert.ok("bottom" in pos, "one pixel under threshold should flip up");
  });
});

// ─── preferredDirection: "up" (InputDetailDrawer's picker — the mirror-image fix) ──

test("up-preferred: stays up when there's enough room above", () => {
  withViewport(1200, 800, () => {
    // anchor near the bottom: top=700, plenty of room above (>= 280+48=328)
    const pos = computeFlipPosition(rect(700, 730, 100, 300), { panelHeight: 280, preferredDirection: "up", align: "left" });
    assert.deepEqual(pos, { position: "fixed", bottom: 104, left: 100 });
  });
});

test("up-preferred: falls back down when there's not enough room above", () => {
  withViewport(1200, 800, () => {
    // anchor near the top: top=100, only 100px of room above (< 328)
    const pos = computeFlipPosition(rect(100, 130, 100, 300), { panelHeight: 280, preferredDirection: "up", align: "left" });
    assert.deepEqual(pos, { position: "fixed", top: 134, left: 100 });
  });
});

test("up-preferred is the mirror image, not the down-preferred check run backwards — same anchor, opposite outcome from down-preferred at the same geometry", () => {
  withViewport(1200, 800, () => {
    // A mid-viewport anchor with symmetric space above/below: both directions
    // individually have enough room, so both preferences should independently
    // choose to stay in their own preferred direction — proving the two modes
    // read genuinely different sides of the anchor, not the same formula twice.
    const anchor = rect(360, 400, 0, 0); // spaceAbove=360, spaceBelow=400
    const down = computeFlipPosition(anchor, { panelHeight: 280 });
    const up = computeFlipPosition(anchor, { panelHeight: 280, preferredDirection: "up" });
    assert.ok("top" in down, "down-preferred should open downward here");
    assert.ok("bottom" in up, "up-preferred should open upward here");
  });
});

// ─── Horizontal alignment ─────────────────────────────────────────────────────

test("align defaults to right-anchored (right: innerWidth - anchorRect.right)", () => {
  withViewport(1000, 800, () => {
    const pos = computeFlipPosition(rect(80, 100, 300, 350), { panelHeight: 100 });
    assert.equal(pos.right, 650);
    assert.equal("left" in pos, false);
  });
});

test("align: 'left' anchors on the trigger's left edge instead", () => {
  withViewport(1000, 800, () => {
    const pos = computeFlipPosition(rect(80, 100, 300, 350), { panelHeight: 100, align: "left" });
    assert.equal(pos.left, 300);
    assert.equal("right" in pos, false);
  });
});

// ─── gap ───────────────────────────────────────────────────────────────────────

test("gap defaults to 4px and is configurable", () => {
  withViewport(1200, 800, () => {
    const defaultGap = computeFlipPosition(rect(80, 100, 0, 0), { panelHeight: 280 });
    assert.equal(defaultGap.top, 104);
    const customGap = computeFlipPosition(rect(80, 100, 0, 0), { panelHeight: 280, gap: 10 });
    assert.equal(customGap.top, 110);
  });
});
