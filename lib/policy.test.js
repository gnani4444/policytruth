import { test } from "node:test";
import assert from "node:assert/strict";
import { policyChecks, lastUpdated } from "./policy.js";

test("article 13 coverage and freshness", () => {
  const text = "Last updated: 3 March 2024. We are the data controller. Our lawful basis is legitimate interests. You may withdraw your consent at any time and complain to the Information Commissioner.";
  const r = policyChecks(text);
  const on = r.article13.filter((i) => i.present).map((i) => i.id);
  assert.deepEqual(on, ["controller", "lawful_basis", "withdraw", "ico"]);
  assert.equal(r.coverage, 44);
  assert.equal(lastUpdated(text, new Date("2024-03-13")).ageDays, 10);
});
