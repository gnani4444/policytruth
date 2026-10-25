import { GoogleGenAI } from "@google/genai";
import { ObjectId } from "mongodb";
import { detect, findPolicyUrl, htmlToText, verify } from "../../../lib/scan.js";
import { audits } from "../../../lib/db.js";

export const maxDuration = 60;

const MODEL = process.env.GEMINI_MODEL || "gemini-4-argon";
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";
const WEIGHT = { high: 25, medium: 12, low: 5 };

// Fallback cache when MongoDB is not configured; lives per server instance.
const memory = globalThis._ptMemory || (globalThis._ptMemory = new Map());
const today = () => new Date().toISOString().slice(0, 10);

async function get(url) {
  const r = await fetch(url, { headers: { "user-agent": UA, accept: "text/html" }, redirect: "follow", signal: AbortSignal.timeout(12000) });
  if (!r.ok) throw new Error(`${url} returned HTTP ${r.status}`);
  return (await r.text()).slice(0, 2_000_000);
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

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const col = await audits().catch(() => null);

  // Step 2: human approved specific findings, now draft fixes for those only.
  if (body.action === "fix") {
    if (!process.env.GEMINI_API_KEY) return bad("GEMINI_API_KEY is not set on the server", 500);
    const approved = (body.findings || []).slice(0, 20);
    if (!approved.length) return bad("No approved findings");
    try {
      const out = await gemini(`You are a UK privacy engineer (UK GDPR, PECR). A human reviewer approved these verified findings for ${body.url}:
${JSON.stringify(approved, null, 2)}
Return JSON: {"code_fixes":[{"tracker_id":"","explanation":"","snippet":"HTML/JS showing the script blocked until consent, e.g. type=text/plain + CMP category, or Google Consent Mode default denied"}],"policy_redline":"Markdown paragraph(s) to ADD to the privacy policy disclosing each vendor, purpose, lawful basis (consent) and retention","summary":"one sentence"}`);
      if (col && body.auditId && ObjectId.isValid(body.auditId)) {
        await col.updateOne({ _id: new ObjectId(body.auditId) }, { $set: { approved, fixes: out, approvedAt: new Date() } }).catch(() => {});
      }
      return Response.json(out);
    } catch (e) { return bad(e.message, 502); }
  }

  // Step 1: scan + model analysis + verification.
  let url;
  try { url = new URL(/^https?:\/\//.test(body.url) ? body.url : `https://${body.url}`); } catch { return bad("Invalid URL"); }
  if (!["http:", "https:"].includes(url.protocol) || /^(localhost|127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(url.hostname)) return bad("Public http(s) URLs only");
  const host = url.hostname.replace(/^www\./, "");

  // Same host already audited today: serve that instead of spending another model call.
  if (!body.force) {
    const start = new Date(today() + "T00:00:00Z");
    const hit = col ? await col.findOne({ host, createdAt: { $gte: start } }, { sort: { createdAt: -1 } }).catch(() => null) : memory.get(`${host}|${today()}`);
    if (hit) return Response.json({ ...hit, auditId: hit._id || hit.auditId, cached: true });
  }
  if (!process.env.GEMINI_API_KEY) return bad("GEMINI_API_KEY is not set on the server", 500);

  const log = [];
  const timings = {};
  const t0 = performance.now();
  try {
    let t = performance.now();
    const html = await get(url.toString());
    timings.fetch = ms(t);
    log.push(`Fetched ${url} (${html.length.toLocaleString()} bytes)`);

    t = performance.now();
    const policyUrl = body.policyUrl || findPolicyUrl(html, url);
    let policyText = "";
    try { policyText = htmlToText(await get(policyUrl)).slice(0, 400_000); log.push(`Fetched privacy policy ${policyUrl} (${policyText.length.toLocaleString()} chars)`); }
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

    const result = {
      url: url.toString(), host, policyUrl, model: MODEL, scan, findings, log, timings,
      policy_summary: analysis.policy_summary, risk_summary: analysis.risk_summary,
      policyWords: policyText ? policyText.split(" ").length : 0, pageBytes: html.length,
      ...score(findings), createdAt: new Date(),
    };
    timings.total = ms(t0);
    if (col) {
      const { insertedId } = await col.insertOne({ ...result });
      result.auditId = insertedId;
      log.push(`Saved audit ${insertedId} to MongoDB Atlas`);
    } else memory.set(`${host}|${today()}`, result);
    return Response.json({ ...result, cached: false, db: !!col });
  } catch (e) {
    return bad(e.message, 502);
  }
}

// Recent audits, shown as history on the page.
export async function GET() {
  const col = await audits().catch(() => null);
  const rows = col
    ? await col.find({}, { projection: { host: 1, url: 1, createdAt: 1, score: 1, grade: 1, findings: 1, approvedAt: 1 } }).sort({ createdAt: -1 }).limit(15).toArray()
    : [...memory.values()].reverse();
  return Response.json({
    db: !!col,
    audits: rows.map((r) => ({ id: r._id || r.host, host: r.host, url: r.url, createdAt: r.createdAt, score: r.score, grade: r.grade, verified: (r.findings || []).filter((f) => f.verified).length, approved: !!r.approvedAt })),
  });
}
