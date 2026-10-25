// Agentic audit: Gemini plans which pages to inspect via tool calls, submits findings,
// then revises them using the verifier's rejection reasons (one feedback round).
import { GoogleGenAI, Type } from "@google/genai";
import { detect, htmlToText, verify } from "./scan.js";
import { policyChecks } from "./policy.js";

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";
const MAX_STEPS = 10;
const MAX_PAGES = 6;

const FINDING = {
  type: Type.OBJECT,
  properties: {
    tracker_id: { type: Type.STRING },
    issue: { type: Type.STRING, enum: ["undisclosed", "pre_consent", "vague_disclosure"] },
    severity: { type: Type.STRING, enum: ["high", "medium", "low"] },
    page: { type: Type.STRING, description: "URL of the page where the tracker was seen" },
    policy_quote: { type: Type.STRING, description: "EXACT sentence copied from a policy you read, or empty" },
    explanation: { type: Type.STRING },
  },
  required: ["tracker_id", "issue", "severity", "explanation"],
};

const TOOLS = [{
  functionDeclarations: [
    { name: "inspect_page", description: "Fetch a page on the audited site. Returns trackers found in its source, consent managers, and its same-site links (text + URL) so you can choose what to inspect next.", parameters: { type: Type.OBJECT, properties: { url: { type: Type.STRING }, reason: { type: Type.STRING, description: "Why you are inspecting this page" } }, required: ["url", "reason"] } },
    { name: "read_policy", description: "Fetch a privacy or cookie policy page and return its full text plus UK GDPR Article 13 coverage.", parameters: { type: Type.OBJECT, properties: { url: { type: Type.STRING }, reason: { type: Type.STRING } }, required: ["url", "reason"] } },
    { name: "submit_findings", description: "Submit the final audit. Only cite tracker_id values you saw via inspect_page and quotes from policies you read.", parameters: { type: Type.OBJECT, properties: { findings: { type: Type.ARRAY, items: FINDING }, policy_summary: { type: Type.STRING }, risk_summary: { type: Type.STRING }, pages_still_unchecked: { type: Type.STRING, description: "Important pages you could not check, if any" } }, required: ["findings", "policy_summary", "risk_summary"] } },
  ],
}];

const sameSite = (a, b) => a.replace(/^www\./, "") === b.replace(/^www\./, "");

export async function runAgent({ url, model, apiKey }) {
  const ai = new GoogleGenAI({ apiKey });
  const root = new URL(url);
  const pages = new Map(); // url -> { html, scan }
  const policies = new Map(); // url -> text
  const trace = [];
  const log = [];

  async function fetchText(u) {
    const target = new URL(u, root);
    // Stay on the audited site: the agent must not be steered to other hosts.
    if (!sameSite(target.hostname, root.hostname) || !/^https?:$/.test(target.protocol)) throw new Error(`refused: ${target.hostname} is not the audited site`);
    const r = await fetch(target, { headers: { "user-agent": UA, accept: "text/html" }, redirect: "follow", signal: AbortSignal.timeout(12000) });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return { url: target.toString(), text: (await r.text()).slice(0, 2_000_000) };
  }

  const tools = {
    async inspect_page({ url: u }) {
      if (pages.size >= MAX_PAGES) return { error: `page budget of ${MAX_PAGES} reached; read policies or submit` };
      const { url: final, text } = await fetchText(u);
      const scan = detect(text, [...policies.values()].join(" "));
      pages.set(final, { html: text, scan });
      const links = [...text.matchAll(/<a[^>]+href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)]
        .map(([, href, t]) => { try { const l = new URL(href, final); return sameSite(l.hostname, root.hostname) ? { url: l.toString(), text: htmlToText(t).slice(0, 60) } : null; } catch { return null; } })
        .filter((l) => l && l.text).slice(0, 60);
      return { url: final, trackers: scan.trackers.map((t) => ({ tracker_id: t.id, vendor: t.vendor, gatedByConsent: t.gatedByConsent })), consent_managers: scan.cmp, links };
    },
    async read_policy({ url: u }) {
      const { url: final, text } = await fetchText(u);
      const plain = htmlToText(text).slice(0, 300_000);
      policies.set(final, plain);
      const c = policyChecks(plain);
      return { url: final, words: plain.split(" ").length, article13_missing: c.article13.filter((i) => !i.present).map((i) => i.label), text: plain };
    },
  };

  const contents = [{ role: "user", parts: [{ text: `Audit ${root} for mismatches between what the site loads and what its privacy and cookie policies say (UK GDPR, PECR: non-essential trackers need prior consent; vendors must be disclosed).
Plan like an auditor: inspect the homepage, then the pages most likely to carry extra trackers (signup, pricing, checkout, contact, blog), then read the privacy policy and any cookie policy. You have at most ${MAX_PAGES} page inspections. Then call submit_findings.` }] }];

  let submitted = null;
  let revised = false;
  for (let step = 0; step < MAX_STEPS; step++) {
    const r = await ai.models.generateContent({ model, contents, config: { tools: TOOLS, thinkingConfig: { thinkingLevel: "medium" } } });
    const calls = r.functionCalls || [];
    contents.push(r.candidates?.[0]?.content || { role: "model", parts: [{ text: r.text || "" }] });
    if (!calls.length) { trace.push({ step, tool: "message", summary: (r.text || "").slice(0, 300) }); contents.push({ role: "user", parts: [{ text: "Continue: use the tools, then call submit_findings." }] }); continue; }

    const responses = [];
    for (const c of calls) {
      if (c.name === "submit_findings") {
        submitted = c.args;
        const findings = verifyAll(c.args.findings);
        const rejected = findings.filter((f) => !f.verified);
        trace.push({ step, tool: "submit_findings", summary: `${findings.length} findings submitted, verifier rejected ${rejected.length}` });
        if (rejected.length && !revised) {
          // Feedback loop: return the verifier's reasons so the agent can fix or drop those claims.
          revised = true;
          responses.push({ functionResponse: { id: c.id, name: c.name, response: { verifier: "Some findings were rejected. Fix them with evidence (inspect or read more pages if needed) or drop them, then call submit_findings again.", rejected: rejected.map((f) => ({ tracker_id: f.tracker_id, issue: f.issue, reasons: f.rejected_because })) } } });
          continue;
        }
        return finish(submitted, findings);
      }
      const t0 = performance.now();
      let result;
      try { result = await tools[c.name](c.args); } catch (e) { result = { error: e.message }; }
      const ms = Math.round(performance.now() - t0);
      trace.push({ step, tool: c.name, url: c.args?.url, reason: c.args?.reason, ms, summary: result.error ? `error: ${result.error}` : c.name === "inspect_page" ? `${result.trackers.length} tracker${result.trackers.length === 1 ? "" : "s"}, ${result.links.length} links` : `${result.words} words, Article 13 missing: ${result.article13_missing.length}` });
      responses.push({ functionResponse: { id: c.id, name: c.name, response: result } });
    }
    contents.push({ role: "user", parts: responses });
  }
  if (submitted) return finish(submitted, verifyAll(submitted.findings));
  throw new Error(`Agent did not submit findings within ${MAX_STEPS} steps`);

  function combined() {
    const html = [...pages.values()].map((p) => p.html).join("\n");
    const policyText = [...policies.values()].join("\n");
    return { html, policyText, scan: detect(html, policyText) };
  }
  function verifyAll(findings) {
    const { html, policyText, scan } = combined();
    return verify(findings || [], scan, html, policyText);
  }
  function finish(sub, findings) {
    const { html, policyText, scan } = combined();
    // Remember which page each tracker was first seen on.
    for (const t of scan.trackers) t.page = [...pages.entries()].find(([, p]) => p.scan.trackers.some((x) => x.id === t.id))?.[0];
    log.push(`Agent inspected ${pages.size} pages and read ${policies.size} policies in ${trace.length} steps`);
    log.push(`Verifier confirmed ${findings.filter((f) => f.verified).length} of ${findings.length} findings${revised ? " after one revision round" : ""}`);
    return { scan, findings, html, policyText, trace, log, revised, pagesInspected: [...pages.keys()], policyUrls: [...policies.keys()], policy_summary: sub.policy_summary, risk_summary: sub.risk_summary, unchecked: sub.pages_still_unchecked || null };
  }
}
