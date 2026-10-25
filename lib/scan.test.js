import { test } from "node:test";
import assert from "node:assert/strict";
import { detect, verify } from "./scan.js";

const html = `<html><script src="https://connect.facebook.net/en_US/fbevents.js"></script>
<script type="text/plain" data-cookieconsent="statistics" src="https://static.hotjar.com/c/hotjar.js"></script></html>`;
const policy = "We use Hotjar to understand how visitors use our site.";

test("detects trackers, consent gating and disclosure", () => {
  const s = detect(html, policy);
  const meta = s.trackers.find((t) => t.id === "meta_pixel");
  const hj = s.trackers.find((t) => t.id === "hotjar");
  assert.equal(meta.gatedByConsent, false);
  assert.equal(meta.disclosedInPolicy, false);
  assert.equal(hj.gatedByConsent, true);
  assert.equal(hj.disclosedInPolicy, true);
});

test("verifier rejects claims contradicted by evidence", () => {
  const s = detect(html, policy);
  const out = verify([
    { tracker_id: "meta_pixel", issue: "undisclosed" },
    { tracker_id: "hotjar", issue: "undisclosed" },
    { tracker_id: "tiktok_pixel", issue: "undisclosed" },
  ], s, html, policy);
  assert.deepEqual(out.map((f) => f.verified), [true, false, false]);
});
