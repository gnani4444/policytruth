import { GoogleGenAI } from "@google/genai";
import { detect, findPolicyUrl, htmlToText, verify } from "../../../lib/scan.js";
import { store } from "../../../lib/db.js";
import { policyChecks, privacyHeaders } from "../../../lib/policy.js";
import { runAgent } from "../../../lib/agent.js";

export const maxDuration = 300;

const MODEL = process.env.GEMINI_MODEL || "gemini-4-argon";
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";
const WEIGHT = { high: 25, medium: 12, low: 5 };

const today = () => new Date().toISOString().slice(0, 10);

async function get(url) {
  const r = await fetch(url, { headers: { "user-agent": UA, accept: "text/html" }, redirect: "follow", signal: AbortSignal.timeout(12000) });
  if (!r.ok) throw new Error(`${url} returned HTTP ${r.status}`);
  const text = (await r.text()).slice(0, 2_000_000);
  return { text, headers: r.headers };
}

async function gemini(prompt) {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const base = { model: MODEL, contents: prompt };
  try {
    const r = await ai.models.generateContent({ ...base, config: { responseMimeType: "application/json", thinkingConfig: { thinkingLevel: "high" } } });
    return JSON.parse(r.text);
  } catch (e) {
    if (/402|RESOURCE_EXHAUSTED|API key/i.test(e.message)) throw e;
    // Older models reject thinkingLevel; retry plain rather than failing the live demo.
    const r = await ai.models.generateContent({ ...base, config: { responseMimeType: "application/json" } });
    return JSON.parse(r.text);
  }
}

const bad = (msg, status = 400) => Response.json({ error: msg }, { status });
const ms = (t) => Math.round(performance.now() - t);

function score(findings) {
  const v = findings.filter((f) => f.verified);
  const s = Math.max(0, 100 - v.reduce((a, f) => a + (WEIGHT[f.severity] || 5), 0));
  return { score: s, grade: s >= 90 ? "A" : s >= 75 ? "B" : s >= 60 ? "C" : s >= 40 ? "D" : "F" };
}

// Store the audit; the log line says where it went so the run log shows a storage fallback.
async function save(db, result) {
  const before = db.kind;
  result.auditId = await db.insert(result);
  const kind = (await store()).kind === "mongodb" && before === "mongodb" ? "mongodb" : "json";
  result.log.push(kind === "mongodb" ? `Saved audit ${result.auditId} to MongoDB Atlas` : `Saved audit ${result.auditId} to JSON storage (MongoDB unavailable)`);
  return { ...result, cached: false, storage: kind, db: kind === "mongodb" };
}

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const db = await store();

  // Step 2: human approved specific findings, now draft fixes for those only.
  if (body.action === "fix") {
    if (!process.env.GEMINI_API_KEY) return bad("GEMINI_API_KEY is not set on the server", 500);
    const approved = (body.findings || []).slice(0, 20);
    if (!approved.length) return bad("No approved findings");
    try {
      const out = await gemini(`You are a UK privacy engineer (UK GDPR, PECR). A human reviewer approved these verified findings for ${body.url}:
${JSON.stringify(approved, null, 2)}
Return JSON: {"code_fixes":[{"tracker_id":"","explanation":"","snippet":"HTML/JS showing the script blocked until consent, e.g. type=text/plain + CMP category, or Google Consent Mode default denied"}],"policy_redline":"Markdown paragraph(s) to ADD to the privacy policy disclosing each vendor, purpose, lawful basis (consent) and retention","summary":"one sentence"}`);
      if (body.auditId) await db.approve(String(body.auditId), { approved, fixes: out, approvedAt: new Date() }).catch(() => {});
      return Response.json(out);
    } catch (e) { return bad(e.message, 502); }
  }

  // Step 1: scan + model analysis + verification.
  let url;
  try { url = new URL(/^https?:\/\//.test(body.url) ? body.url : `https://${body.url}`); } catch { return bad("Invalid URL"); }
  if (!["http:", "https:"].includes(url.protocol) || /^(localhost|127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(url.hostname)) return bad("Public http(s) URLs only");
  const host = url.hostname.replace(/^www\./, "");
  const mode = body.mode === "agent" ? "agent" : "quick";

  // Same host already audited today: serve that instead of spending another model call.
  if (!body.force) {
    const start = new Date(today() + "T00:00:00Z");
    const hit = await db.today(host, mode, start).catch(() => null);
    if (hit) return Response.json({ ...hit, auditId: hit._id || hit.auditId, cached: true, storage: db.kind });
  }
  if (!process.env.GEMINI_API_KEY) return bad("GEMINI_API_KEY is not set on the server", 500);

  if (mode === "agent") {
    const t0 = performance.now();
    try {
      const a = await runAgent({ url: url.toString(), model: MODEL, apiKey: process.env.GEMINI_API_KEY });
      const prev = await db.previous(host).catch(() => null);
      const changes = prev ? { since: prev.createdAt, previousScore: prev.score, added: a.scan.trackers.map((t) => t.vendor).filter((v) => !prev.scan.trackers.some((x) => x.vendor === v)), removed: prev.scan.trackers.map((t) => t.vendor).filter((v) => !a.scan.trackers.some((x) => x.vendor === v)) } : null;
      const result = {
        mode, url: url.toString(), host, model: MODEL, scan: a.scan, findings: a.findings, log: a.log, trace: a.trace, revised: a.revised,
        pagesInspected: a.pagesInspected, policyUrl: a.policyUrls[0] || null, policyUrls: a.policyUrls, unchecked: a.unchecked,
        policy_summary: a.policy_summary, risk_summary: a.risk_summary, policy: policyChecks(a.policyText), headers: null, changes,
        policyWords: a.policyText ? a.policyText.split(" ").length : 0, pageBytes: a.html.length, ...score(a.findings), createdAt: new Date(),
        timings: { total: ms(t0) },
      };
      return Response.json(await save(db, result));
    } catch (e) { return bad(e.message, 502); }
  }

  const log = [];
  const timings = {};
  const t0 = performance.now();
  try {
    let t = performance.now();
    const page = await get(url.toString());
    const html = page.text;
    timings.fetch = ms(t);
    log.push(`Fetched ${url} (${html.length.toLocaleString()} bytes)`);

    t = performance.now();
    const policyUrl = body.policyUrl || findPolicyUrl(html, url);
    let policyText = "";
    try { policyText = htmlToText((await get(policyUrl)).text).slice(0, 400_000); log.push(`Fetched privacy policy ${policyUrl} (${policyText.length.toLocaleString()} chars)`); }
    catch (e) { log.push(`Privacy policy not reachable at ${policyUrl}: ${e.message}`); }
    timings.policy = ms(t);

    t = performance.now();
    const scan = detect(html, policyText);
    timings.scan = ms(t);
    log.push(`Detected ${scan.trackers.length} trackers, consent manager: ${scan.cmp.join(", ") || "none"}`);

    t = performance.now();
    const analysis = await gemini(`You audit websites against their own privacy policy under UK GDPR and PECR (non-essential cookies/trackers need prior consent).
SITE: ${url}
CONSENT MANAGER DETECTED: ${scan.cmp.join(", ") || "none"}
TRACKERS FOUND IN PAGE SOURCE (deterministic scan; gatedByConsent = script tag is blocked until consent; disclosedInPolicy = vendor name appears in policy):
${JSON.stringify(scan.trackers, null, 1)}
OTHER THIRD-PARTY SCRIPT HOSTS: ${scan.scriptHosts.join(", ")}
PRIVACY POLICY TEXT (${policyUrl}):
"""${policyText || "(not available)"}"""

Find mismatches between what the site does and what the policy says. Only use tracker_id values from the list above.
Issue types: "undisclosed" (tracker loads but policy never names the vendor or category), "pre_consent" (tracker loads with no consent gating), "vague_disclosure" (policy mentions it only vaguely, e.g. "third parties").
Return JSON: {"policy_summary":"2 sentences on what the policy claims","findings":[{"tracker_id":"","issue":"undisclosed|pre_consent|vague_disclosure","severity":"high|medium|low","policy_quote":"EXACT sentence copied from the policy text, or null","explanation":"one or two sentences, plain English"}],"risk_summary":"one sentence for a founder"}`);
    timings.model = ms(t);

    t = performance.now();
    const findings = verify(analysis.findings, scan, html, policyText);
    timings.verify = ms(t);
    log.push(`Gemini proposed ${findings.length} findings; verifier confirmed ${findings.filter((f) => f.verified).length}, rejected ${findings.filter((f) => !f.verified).length}`);

    const policy = policyChecks(policyText);
    const headers = privacyHeaders(page.headers);
    // Compare with the previous audit of this host to show tracker drift over time.
    let changes = null;
    const prev = await db.previous(host).catch(() => null);
    if (prev) {
      const before = new Set(prev.scan.trackers.map((t) => t.vendor)), now = new Set(scan.trackers.map((t) => t.vendor));
      changes = { since: prev.createdAt, previousScore: prev.score, added: [...now].filter((v) => !before.has(v)), removed: [...before].filter((v) => !now.has(v)) };
    }
    const result = {
      mode, policy, headers, changes,
      url: url.toString(), host, policyUrl, model: MODEL, scan, findings, log, timings,
      policy_summary: analysis.policy_summary, risk_summary: analysis.risk_summary,
      policyWords: policyText ? policyText.split(" ").length : 0, pageBytes: html.length,
      ...score(findings), createdAt: new Date(),
    };
    timings.total = ms(t0);
    return Response.json(await save(db, result));
  } catch (e) {
    return bad(e.message, 502);
  }
}

// Recent audits, shown as history on the page.
export async function GET() {
  const db = await store();
  const rows = await db.recent(15);
  const kind = (await store()).kind;
  return Response.json({
    db: kind === "mongodb", storage: kind,
    audits: rows.map((r) => ({ id: r._id || r.auditId || r.host, host: r.host, mode: r.mode || "quick", url: r.url, createdAt: r.createdAt, score: r.score, grade: r.grade, verified: (r.findings || []).filter((f) => f.verified).length, approved: !!r.approvedAt })),
  });
}
