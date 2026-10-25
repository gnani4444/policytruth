import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

// No MONGODB_URI: audits go to the JSON file, seeded from data/audits.seed.json.
process.env.PT_DATA_FILE = path.join(mkdtempSync(path.join(tmpdir(), "pt-")), "audits.json");
delete process.env.MONGODB_URI;
const { store } = await import("./db.js");

test("JSON storage serves seed, saves, approves and survives a reload", async () => {
  const s = await store();
  assert.equal(s.kind, "json");
  assert.ok((await s.recent(15)).length > 0);
  const since = new Date(Date.now() - 60_000);
  const id = await s.insert({ host: "example.org", mode: "quick", createdAt: new Date(), scan: { trackers: [] }, findings: [], log: [] });
  await s.approve(id, { approvedAt: new Date() });
  assert.equal((await s.today("example.org", "agent", since)), null);
  globalThis._ptJson = null;
  const again = await (await store()).today("example.org", "quick", since);
  assert.equal(String(again.auditId), String(id));
  assert.ok(again.approvedAt instanceof Date);
});
