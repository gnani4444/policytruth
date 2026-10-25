"use client";
import { useEffect, useMemo, useState } from "react";

const today = () => new Date().toISOString().slice(0, 10);
const hostOf = (u) => { try { return new URL(/^https?:\/\//.test(u) ? u : `https://${u}`).hostname.replace(/^www\./, ""); } catch { return ""; } };
const store = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};
const EXAMPLES = ["theguardian.com", "asos.com", "bbc.co.uk", "monzo.com"];
const TABS = [["overview", "Overview"], ["agent", "Agent trace"], ["findings", "Findings"], ["trackers", "Trackers"], ["policy", "Policy"], ["fixes", "Fixes"], ["history", "History"], ["about", "How it works"]];
const ISSUE = { undisclosed: "Undisclosed", pre_consent: "Loads before consent", vague_disclosure: "Vague disclosure" };

async function post(body) {
  const r = await fetch("/api/audit", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({ error: `HTTP ${r.status}` }));
  if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
  return j;
}

function download(name, text, type) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

function markdown(res, fix) {
  const v = res.findings.filter((f) => f.verified);
  return [
    `# PolicyTruth audit: ${res.host}`, ``,
    `Date: ${new Date(res.createdAt).toLocaleString()} · Model: ${res.model} · Score: ${res.score}/100 (${res.grade})`, ``,
    `**Risk:** ${res.risk_summary}`, ``, `**Policy claims:** ${res.policy_summary}`, ``,
    `## Trackers`, ...res.scan.trackers.map((t) => `- ${t.vendor}: ${t.gatedByConsent ? "consent-gated" : "loads without consent gate"}, ${t.disclosedInPolicy ? "named in policy" : "not named in policy"}`), ``,
    `## Verified findings`, ...v.map((f) => `- [${f.severity}] ${f.vendor}, ${ISSUE[f.issue] || f.issue}: ${f.explanation}`), ``,
    `## Rejected by verifier`, ...res.findings.filter((f) => !f.verified).map((f) => `- ${f.vendor}, ${f.issue}: ${f.rejected_because.join("; ")}`), ``,
    ...(fix ? [`## Draft fixes`, fix.summary, ``, ...(fix.code_fixes || []).map((c) => `### ${c.tracker_id}\n${c.explanation}\n\n\`\`\`html\n${c.snippet}\n\`\`\``), ``, `## Policy addition`, fix.policy_redline] : []),
  ].join("\n");
}

const Icon = ({ d, size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>
);
const I = {
  shield: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />,
  check: <path d="M20 6 9 17l-5-5" />,
  x: <><path d="M18 6 6 18" /><path d="m6 6 12 12" /></>,
  alert: <><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /><path d="M12 9v4" /><path d="M12 17h.01" /></>,
  clock: <><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></>,
  db: <><ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M3 5v14c0 1.7 4 3 9 3s9-1.3 9-3V5" /><path d="M3 12c0 1.7 4 3 9 3s9-1.3 9-3" /></>,
  down: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="m7 10 5 5 5-5" /><path d="M12 15V3" /></>,
  copy: <><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></>,
  refresh: <><path d="M21 12a9 9 0 1 1-3-6.7L21 8" /><path d="M21 3v5h-5" /></>,
  print: <><path d="M6 9V2h12v7" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="8" /></>,
};

function Gauge({ score, grade }) {
  const r = 52, c = 2 * Math.PI * r, off = c * (1 - score / 100);
  const color = score >= 75 ? "var(--ok)" : score >= 50 ? "var(--warn)" : "var(--bad)";
  return (
    <svg width="132" height="132" viewBox="0 0 132 132" role="img" aria-label={`Compliance score ${score} of 100, grade ${grade}`}>
      <circle cx="66" cy="66" r={r} fill="none" stroke="var(--line)" strokeWidth="12" />
      <circle cx="66" cy="66" r={r} fill="none" stroke={color} strokeWidth="12" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off} transform="rotate(-90 66 66)" className="gauge-arc" />
      <text x="66" y="64" textAnchor="middle" fontSize="32" fontWeight="700" fill="var(--fg)">{score}</text>
      <text x="66" y="86" textAnchor="middle" fontSize="13" fill="var(--muted)">Grade {grade}</text>
    </svg>
  );
}

const Kpi = ({ label, value, sub, tone }) => (
  <div className="kpi"><div className="kpi-label">{label}</div><div className={`kpi-value ${tone || ""}`}>{value}</div>{sub && <div className="kpi-sub">{sub}</div>}</div>
);
const pct = (n, d) => (d ? Math.round((n / d) * 100) : 0);

export default function Home() {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [res, setRes] = useState(null);
  const [approved, setApproved] = useState({});
  const [fix, setFix] = useState(null);
  const [history, setHistory] = useState({ audits: [], db: false });
  const [sev, setSev] = useState("all");
  const [copied, setCopied] = useState("");
  const [tab, setTab] = useState("overview");
  const [agentMode, setAgentMode] = useState(true);

  const loadHistory = () => fetch("/api/audit").then((r) => r.json()).then(setHistory).catch(() => {});
  useEffect(() => { loadHistory(); }, []);

  async function audit(target, force = false, mode = agentMode ? "agent" : "quick") {
    const host = hostOf(target);
    if (!host) return setErr("Enter a valid website address");
    setUrl(target); setErr(""); setFix(null); setApproved({});
    const key = `pt:${host}:${mode}:${today()}`;
    // Browser cache first: an audit of this host from today is reused without a network call.
    const local = !force && store.get(key);
    if (local) { setRes({ ...local, cached: true, cacheSource: "browser" }); setTab("overview"); return; }
    setBusy("audit"); setRes(null);
    try {
      const r = await post({ url: target, force, mode });
      const out = { ...r, cacheSource: r.cached ? "server" : null };
      setRes(out); store.set(key, r); loadHistory(); setTab("overview");
    } catch (e) { setErr(e.message); }
    setBusy("");
  }

  async function draftFixes() {
    setBusy("fix"); setErr("");
    try { setFix(await post({ action: "fix", url: res.url, auditId: res.auditId, findings: res.findings.filter((f, i) => approved[i]) })); setTab("fixes"); }
    catch (e) { setErr(e.message); }
    setBusy("");
  }

  const copy = (text, id) => navigator.clipboard?.writeText(text).then(() => { setCopied(id); setTimeout(() => setCopied(""), 1500); });

  const m = useMemo(() => {
    if (!res) return null;
    const t = res.scan.trackers, v = res.findings.filter((f) => f.verified), rej = res.findings.filter((f) => !f.verified);
    const bySev = { high: 0, medium: 0, low: 0 };
    v.forEach((f) => { bySev[f.severity] = (bySev[f.severity] || 0) + 1; });
    return {
      trackers: t.length, gated: t.filter((x) => x.gatedByConsent).length, disclosed: t.filter((x) => x.disclosedInPolicy).length,
      verified: v, rejected: rej, bySev, precision: pct(v.length, res.findings.length), hosts: res.scan.scriptHosts.length,
    };
  }, [res]);

  const shown = m ? m.verified.filter((f) => sev === "all" || f.severity === sev) : [];
  const approvedCount = Object.values(approved).filter(Boolean).length;
  const steps = res ? [
    ["Fetch page", res.timings?.fetch], ["Fetch privacy policy", res.timings?.policy], ["Deterministic tracker scan", res.timings?.scan],
    [`Gemini analysis (${res.model})`, res.timings?.model], ["Evidence verifier", res.timings?.verify],
  ] : [];

  return (
    <div className="shell">
      <header className="top">
        <div className="brand"><span className="logo"><Icon d={I.shield} size={18} /></span>PolicyTruth</div>
        <nav className="tabs" aria-label="Sections">
          {TABS.map(([id, label]) => {
            const count = id === "findings" && m ? m.verified.length : id === "trackers" && m ? m.trackers : id === "history" ? history.audits.length : null;
            const off = (!res && !["overview", "history", "about"].includes(id)) || (id === "agent" && res && !res.trace);
            return <button key={id} className={tab === id ? "on" : ""} aria-current={tab === id ? "page" : undefined} disabled={off} onClick={() => setTab(id)}>{label}{count != null && <span className="count">{count}</span>}</button>;
          })}
        </nav>
        <div className="top-meta">
          <span className={`chip ${history.db ? "ok" : ""}`}><Icon d={I.db} size={13} />{history.db ? "MongoDB Atlas connected" : "Local storage mode"}</span>
          <span className="chip">UK GDPR · PECR</span>
        </div>
      </header>

      <div className="layout">
        <main>
          {tab === "overview" && <section className="hero">
            <h1>Does your website do what your privacy policy says?</h1>
            <p className="lead">PolicyTruth compares the trackers your site actually loads with the promises in your privacy policy. Gemini finds the gaps, a verifier rejects anything it cannot prove, and you approve every fix.</p>
            <form onSubmit={(e) => { e.preventDefault(); audit(url); }} className="search">
              <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="yourcompany.co.uk" aria-label="Website address" required />
              <button className="primary" disabled={!!busy}>{busy === "audit" ? <><span className="spin" />Auditing</> : "Run audit"}</button>
            </form>
            <label className="toggle"><input type="checkbox" checked={agentMode} onChange={(e) => setAgentMode(e.target.checked)} /><span><b>Agent mode</b>: Gemini plans the audit, crawls up to 6 pages, reads every policy it finds, and revises its findings when the verifier rejects them.</span></label>
            <div className="examples">Try: {EXAMPLES.map((e) => <button key={e} className="link" onClick={() => audit(e)} disabled={!!busy}>{e}</button>)}</div>
          </section>}
          {err && <div className="alert"><Icon d={I.alert} />{err}</div>}

          {busy === "audit" && (
            <section className="card skeleton-card" aria-live="polite">
              <div className="muted">{agentMode ? "Agent is planning the audit, inspecting pages, reading policies and checking its own findings. This takes 30 to 90 seconds…" : "Fetching the site and policy, scanning trackers, asking Gemini, verifying every claim…"}</div>
              <div className="bar"><div className="bar-fill indeterminate" /></div>
            </section>
          )}

          {res && m && (
            <>
              {tab === "overview" && res.changes && (
                <div className="banner info"><Icon d={I.refresh} />Since the last audit ({new Date(res.changes.since).toLocaleDateString()}, score {res.changes.previousScore ?? "?"}): {res.changes.added.length ? `added ${res.changes.added.join(", ")}` : "no new trackers"}{res.changes.removed.length ? `; removed ${res.changes.removed.join(", ")}` : ""}.</div>
              )}
              {tab === "overview" && res.cached && (
                <div className="banner"><Icon d={I.clock} />Showing today&apos;s audit from {res.cacheSource === "browser" ? "this browser" : "MongoDB"} ({new Date(res.createdAt).toLocaleTimeString()}). No new model call was made.
                  <button className="ghost" onClick={() => audit(res.url, true, res.mode === "agent" ? "agent" : "quick")}><Icon d={I.refresh} size={14} />Re-run now</button></div>
              )}

              {tab === "overview" && <>
              <section className="card overview">
                <Gauge score={res.score ?? 0} grade={res.grade ?? "?"} />
                <div className="overview-text">
                  <div className="eyebrow">{res.host}</div>
                  <h2>{res.risk_summary}</h2>
                  <p className="muted">{res.policy_summary}</p>
                  <div className="actions">
                    <button className="ghost" onClick={() => download(`policytruth-${res.host}.md`, markdown(res, fix), "text/markdown")}><Icon d={I.down} size={14} />Report (.md)</button>
                    <button className="ghost" onClick={() => download(`policytruth-${res.host}.json`, JSON.stringify({ ...res, fix }, null, 2), "application/json")}><Icon d={I.down} size={14} />Raw data (.json)</button>
                    <button className="ghost" onClick={() => window.print()}><Icon d={I.print} size={14} />Print / PDF</button>
                  </div>
                </div>
              </section>

              <section className="kpis">
                <Kpi label="Trackers detected" value={m.trackers} sub={`${m.hosts} third-party script hosts`} />
                <Kpi label="Consent-gated" value={`${pct(m.gated, m.trackers)}%`} sub={`${m.gated} of ${m.trackers} wait for consent`} tone={m.gated < m.trackers ? "bad" : "ok"} />
                <Kpi label="Named in policy" value={`${pct(m.disclosed, m.trackers)}%`} sub={`${m.disclosed} of ${m.trackers} vendors disclosed`} tone={m.disclosed < m.trackers ? "warn" : "ok"} />
                <Kpi label="Verified findings" value={m.verified.length} sub={`${m.bySev.high} high · ${m.bySev.medium} medium · ${m.bySev.low} low`} tone={m.bySev.high ? "bad" : ""} />
                <Kpi label="Rejected by verifier" value={m.rejected.length} sub={`${m.precision}% of model claims survived`} />
                <Kpi label="Consent manager" value={res.scan.cmp[0] || "None"} sub={res.scan.cmp.length > 1 ? res.scan.cmp.slice(1).join(", ") : "detected in page source"} tone={res.scan.cmp.length ? "ok" : "bad"} />
                <Kpi label="Policy length" value={res.policyWords ? res.policyWords.toLocaleString() : "Not found"} sub={res.policyWords ? `words · ~${Math.ceil(res.policyWords / 230)} min read` : "policy page unreachable"} tone={res.policyWords ? "" : "bad"} />
                {res.policy && <Kpi label="Article 13 coverage" value={`${res.policy.coverage}%`} sub={`${res.policy.article13.filter((i) => i.present).length} of ${res.policy.article13.length} required items`} tone={res.policy.coverage >= 80 ? "ok" : res.policy.coverage >= 50 ? "warn" : "bad"} />}
                {res.policy && <Kpi label="Readability" value={res.policy.readability ? res.policy.readability.score : "-"} sub={res.policy.readability ? `Flesch · ${res.policy.readability.label}` : "policy too short or missing"} tone={res.policy.readability?.score >= 50 ? "ok" : "warn"} />}
                {res.policy && <Kpi label="Policy age" value={res.policy.updated ? `${res.policy.updated.ageDays}d` : "Unknown"} sub={res.policy.updated ? `last updated ${res.policy.updated.date}` : "no last-updated date found"} tone={!res.policy.updated || res.policy.updated.ageDays > 365 ? "warn" : "ok"} />}
                {res.headers && <Kpi label="Privacy headers" value={`${res.headers.filter((h) => h.value).length}/${res.headers.length}`} sub={res.headers.filter((h) => !h.value).map((h) => h.label).join(", ") || "all present"} tone={res.headers.every((h) => h.value) ? "ok" : "warn"} />}
                <Kpi label="Audit time" value={res.timings?.total ? `${(res.timings.total / 1000).toFixed(1)}s` : "-"} sub={`page ${Math.round((res.pageBytes || 0) / 1024)} KB`} />
              </section>

              </>}
              <div className="two">
                {tab === "trackers" && <section className="card">
                  <h3>Tracker inventory</h3>
                  <table>
                    <thead><tr><th>Vendor</th><th>Consent gate</th><th>In policy</th></tr></thead>
                    <tbody>
                      {res.scan.trackers.map((t) => (
                        <tr key={t.id}>
                          <td><b>{t.vendor}</b><div className="mono">{t.matched}</div></td>
                          <td>{t.gatedByConsent ? <span className="tag ok"><Icon d={I.check} size={12} />Gated</span> : <span className="tag bad"><Icon d={I.x} size={12} />Fires early</span>}</td>
                          <td>{t.disclosedInPolicy ? <span className="tag ok"><Icon d={I.check} size={12} />“{t.disclosedTerm}”</span> : <span className="tag warn"><Icon d={I.x} size={12} />Missing</span>}</td>
                        </tr>
                      ))}
                      {!res.scan.trackers.length && <tr><td colSpan="3" className="muted">No known trackers in the page source.</td></tr>}
                    </tbody>
                  </table>
                  {!!m.hosts && <details open><summary>All third-party script hosts ({m.hosts})</summary><div className="hosts">{res.scan.scriptHosts.map((h) => <code key={h}>{h}</code>)}</div></details>}
                </section>}

                {tab === "overview" && <section className="card">
                  <h3>Pipeline and verification loop</h3>
                  <ol className="steps">
                    {steps.map(([name, t]) => <li key={name}><span className="dot"><Icon d={I.check} size={12} /></span><span>{name}</span><span className="mono">{t != null ? `${t} ms` : "cached"}</span></li>)}
                    <li><span className="dot"><Icon d={I.db} size={12} /></span><span>Stored for audit trail</span><span className="mono">{res.auditId ? "MongoDB" : "browser"}</span></li>
                  </ol>
                  <h4>Severity breakdown</h4>
                  <div className="stack" role="img" aria-label="Severity breakdown">
                    {["high", "medium", "low"].map((s) => m.bySev[s] ? <div key={s} className={`seg ${s}`} style={{ flex: m.bySev[s] }}>{m.bySev[s]} {s}</div> : null)}
                    {!m.verified.length && <div className="seg none">No verified issues</div>}
                  </div>
                  <details><summary>Run log</summary><div className="log">{res.log.map((l, i) => <div key={i}>{l}</div>)}</div></details>
                </section>}
                {tab === "overview" && <section className="card">
                  <h3>Top findings</h3>
                  {m.verified.slice(0, 4).map((f, i) => <div key={i} className="mini"><span className={`tag ${f.severity === "high" ? "bad" : f.severity === "medium" ? "warn" : ""}`}>{f.severity}</span><span><b>{f.vendor}</b> · {ISSUE[f.issue] || f.issue}</span></div>)}
                  {!m.verified.length && <p className="empty">No verified findings.</p>}
                  <button className="ghost" style={{ marginTop: 12 }} onClick={() => setTab("findings")}>Review and approve findings</button>
                </section>}
              </div>

              {tab === "findings" && <><section className="card">
                <div className="card-head">
                  <h3>Verified findings <span className="muted">({m.verified.length})</span></h3>
                  <div className="seg-ctl" role="tablist" aria-label="Filter by severity">
                    {["all", "high", "medium", "low"].map((s) => <button key={s} className={sev === s ? "on" : ""} onClick={() => setSev(s)}>{s}</button>)}
                  </div>
                </div>
                <p className="muted">Each finding is backed by evidence from the page source and the policy text. Tick the ones you want fixed. Nothing is changed on your site.</p>
                {shown.map((f) => {
                  const i = res.findings.indexOf(f);
                  return (
                    <label key={i} className={`finding ${approved[i] ? "picked" : ""}`}>
                      <input type="checkbox" checked={!!approved[i]} onChange={(e) => setApproved({ ...approved, [i]: e.target.checked })} />
                      <div>
                        <div className="finding-title"><span className={`tag ${f.severity === "high" ? "bad" : f.severity === "medium" ? "warn" : ""}`}>{f.severity}</span><b>{f.vendor}</b><span className="muted">· {ISSUE[f.issue] || f.issue}</span></div>
                        <p>{f.explanation}</p>
                        {f.evidence && <div className="evidence"><span>Page source</span><code>{f.evidence}</code></div>}
                        {f.policy_quote && <div className="evidence"><span>Policy says</span><q>{f.policy_quote}</q></div>}
                      </div>
                    </label>
                  );
                })}
                {!shown.length && <p className="empty">No verified findings{sev !== "all" ? ` at ${sev} severity` : ""}.</p>}
                <div className="actions">
                  <button className="ghost" onClick={() => setApproved(Object.fromEntries(m.verified.map((f) => [res.findings.indexOf(f), true])))} disabled={!m.verified.length}>Select all</button>
                  <button className="primary" disabled={!!busy || !approvedCount} onClick={draftFixes}>{busy === "fix" ? <><span className="spin" />Drafting</> : `Approve and draft ${approvedCount || ""} fix${approvedCount === 1 ? "" : "es"}`}</button>
                </div>
              </section>

              {!!m.rejected.length && (
                <section className="card">
                  <h3>Rejected by the verifier <span className="muted">({m.rejected.length})</span></h3>
                  <p className="muted">Gemini proposed these, but the evidence did not support them, so they are not reported as findings.</p>
                  {m.rejected.map((f, i) => <div key={i} className="rejected"><Icon d={I.x} size={14} /><b>{f.vendor}</b> · {ISSUE[f.issue] || f.issue}<span className="muted"> · {f.rejected_because.join("; ")}</span></div>)}
                </section>
              )}</>}

              {tab === "agent" && res.trace && (
                <section className="card">
                  <h3>Agent trace <span className="muted">({res.trace.length} steps · {res.pagesInspected?.length || 0} pages · {res.policyUrls?.length || 0} policies{res.revised ? " · revised after verifier feedback" : ""})</span></h3>
                  <p className="muted">Every tool call Gemini made, in order, with its stated reason. The agent can only fetch pages on the audited site.</p>
                  <ol className="trace">
                    {res.trace.map((t, i) => (
                      <li key={i} className={t.tool === "submit_findings" ? "submit" : ""}>
                        <span className="tool">{t.tool}</span>
                        <div>
                          {t.url && <div className="mono small">{t.url}</div>}
                          {t.reason && <div>{t.reason}</div>}
                          <div className="muted small">{t.summary}{t.ms != null ? ` · ${t.ms} ms` : ""}</div>
                        </div>
                      </li>
                    ))}
                  </ol>
                  {res.unchecked && <p className="muted"><b>Agent says not checked:</b> {res.unchecked}</p>}
                </section>
              )}

              {tab === "policy" && (
                <div className="two">
                  <section className="card">
                    <h3>UK GDPR Article 13 checklist</h3>
                    {!res.policy && <p className="empty">Re-run this audit to see policy checks.</p>}
                    {res.policy?.article13.map((c) => <div key={c.id} className="mini">{c.present ? <span className="tag ok"><Icon d={I.check} size={12} />Found</span> : <span className="tag bad"><Icon d={I.x} size={12} />Missing</span>}<span>{c.label}</span></div>)}
                    <p className="muted small">Keyword check of the policy text. A missing item is a prompt for review, not proof of a breach.</p>
                  </section>
                  <section className="card">
                    <h3>Policy quality</h3>
                    <div className="mini"><b>Source</b><a href={res.policyUrl} target="_blank" rel="noreferrer" className="mono small">{res.policyUrl}</a></div>
                    <div className="mini"><b>Length</b><span>{res.policyWords?.toLocaleString() || 0} words</span></div>
                    <div className="mini"><b>Readability</b><span>{res.policy?.readability ? `${res.policy.readability.score} (${res.policy.readability.label})` : "n/a"}</span></div>
                    <div className="mini"><b>Last updated</b><span>{res.policy?.updated ? `${res.policy.updated.date} (${res.policy.updated.ageDays} days ago)` : "not stated"}</span></div>
                    <h4>Privacy-related response headers</h4>
                    {res.headers?.map((h) => <div key={h.id} className="mini">{h.value ? <span className="tag ok"><Icon d={I.check} size={12} />Set</span> : <span className="tag warn"><Icon d={I.x} size={12} />Missing</span>}<span>{h.label}</span>{h.value && <code className="small">{h.value.slice(0, 60)}</code>}</div>)}
                  </section>
                </div>
              )}

              {tab === "fixes" && !fix && <section className="card"><h3>Fixes</h3><p className="empty">No fixes drafted yet. Approve findings in the Findings tab first.</p><button className="ghost" onClick={() => setTab("findings")}>Go to findings</button></section>}
              {tab === "fixes" && fix && (
                <section className="card">
                  <h3>Draft fixes <span className="muted">for human review before shipping</span></h3>
                  <p>{fix.summary}</p>
                  {fix.code_fixes?.map((c, i) => (
                    <div key={i} className="fix">
                      <div className="card-head"><b>{c.tracker_id}</b><button className="ghost" onClick={() => copy(c.snippet, `c${i}`)}><Icon d={I.copy} size={14} />{copied === `c${i}` ? "Copied" : "Copy"}</button></div>
                      <p className="muted">{c.explanation}</p>
                      <pre>{c.snippet}</pre>
                    </div>
                  ))}
                  <div className="card-head"><h4>Privacy policy addition</h4><button className="ghost" onClick={() => copy(fix.policy_redline, "p")}><Icon d={I.copy} size={14} />{copied === "p" ? "Copied" : "Copy"}</button></div>
                  <pre>{fix.policy_redline}</pre>
                </section>
              )}
            </>
          )}

          {(tab === "about" || (tab === "overview" && !res && !busy)) && (
            <section className="features">
              {[["Real evidence", "Reads the page source and finds 15 tracker vendors and 8 consent managers."], ["Gemini reasoning", "Gemini reads your entire privacy policy and compares it with what the site loads."], ["Verification loop", "Every model claim is checked against evidence. Unsupported claims are rejected."], ["Human approval", "You approve each finding before any fix is drafted. Every step is stored."]].map(([t, d]) => (
                <div key={t} className="feature"><span className="logo small"><Icon d={I.shield} size={14} /></span><b>{t}</b><p className="muted">{d}</p></div>
              ))}
            </section>
          )}

        {tab === "history" && <section className="card side">
          <h3>Audit history</h3>
          <p className="muted small">{history.db ? "Stored in MongoDB Atlas" : "Stored on this server instance"}. Audits from today load instantly.</p>
          {history.audits.map((a) => (
            <button key={String(a.id) + a.createdAt} className="hist" onClick={() => audit(a.url || a.host, false, a.mode === "agent" ? "agent" : "quick")}>
              <span className={`grade g${a.grade}`}>{a.grade || "?"}</span>
              <span className="hist-body"><b>{a.host}{a.mode === "agent" ? " · agent" : ""}</b><span className="muted small">{new Date(a.createdAt).toLocaleString()} · {a.verified} findings{a.approved ? " · fixed" : ""}</span></span>
            </button>
          ))}
          {!history.audits.length && <p className="empty">No audits yet.</p>}
        </section>}
        </main>
      </div>
      <footer className="foot">PolicyTruth drafts suggestions for human review. It is not legal advice. Built with Gemini and MongoDB Atlas at Encode London 2026.</footer>
    </div>
  );
}
