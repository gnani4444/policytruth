"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion, MotionConfig, AnimatePresence } from "motion/react";
import BlurText from "@/components/reactbits/BlurText";
import CountUp from "@/components/reactbits/CountUp";
import DecryptedText from "@/components/reactbits/DecryptedText";
import { AnimatedBackground } from "@/components/ui/animated-background";
import { TextShimmer } from "@/components/ui/text-shimmer";
import { cn } from "@/lib/utils";

const today = () => new Date().toISOString().slice(0, 10);
const hostOf = (u) => { try { return new URL(/^https?:\/\//.test(u) ? u : `https://${u}`).hostname.replace(/^www\./, ""); } catch { return ""; } };
const store = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};
const EXAMPLES = ["theguardian.com", "asos.com", "bbc.co.uk", "monzo.com"];
const ISSUE = { undisclosed: "Undisclosed", pre_consent: "Loads before consent", vague_disclosure: "Vague disclosure" };
// MOT defect categories: Dangerous and Major fail the test, Minor passes with defects.
const CATEGORY = [
  ["high", "Dangerous", "Fails the test. Fix before anything else."],
  ["medium", "Major", "Fails the test."],
  ["low", "Minor", "Passes, but should be repaired."],
];
const VIEWS = [["defects", "Defects"], ["inspection", "Inspection"], ["log", "Test log"], ["fixes", "Fixes"]];

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

const Icon = ({ d, size = 16, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>{d}</svg>
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
  list: <><path d="M8 6h13" /><path d="M8 12h13" /><path d="M8 18h13" /><path d="M3 6h.01" /><path d="M3 12h.01" /><path d="M3 18h.01" /></>,
  arrow: <><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></>,
  chevron: <path d="m6 9 6 6 6-6" />,
};

const pct = (n, d) => (d ? Math.round((n / d) * 100) : 0);

/* The domain as a UK rear number plate: yellow, ink border, blue UK band. */
function Plate({ children, size = "lg", className }) {
  const big = size === "lg";
  return (
    <span className={cn("plate inline-flex max-w-full items-stretch overflow-hidden", className)}>
      <span className={cn("flex flex-col items-center justify-center bg-band font-bold text-white wide", big ? "w-9 text-xs" : "w-5 text-[8px]")} aria-hidden="true">UK</span>
      <span className={cn("flex items-center font-extrabold uppercase tracking-[0.04em] wide", big ? "min-w-0 break-all px-3 py-2 text-[clamp(0.95rem,4.5vw,1.875rem)] sm:px-4 [&_*]:whitespace-normal" : "px-2 py-0.5 text-xs")}>{children}</span>
    </span>
  );
}

function Verdict({ verdict }) {
  const tone = verdict === "FAIL" ? "text-fail border-fail" : verdict === "REFUSED" ? "text-muted border-muted" : "text-pass border-pass";
  const word = { FAIL: "FAIL", REFUSED: "REFUSED" }[verdict] || "PASS";
  return (
    <motion.div
      initial={{ opacity: 0, scale: 1.6, rotate: -14, filter: "blur(8px)" }}
      animate={{ opacity: 1, scale: 1, rotate: -4, filter: "blur(0px)" }}
      transition={{ type: "spring", stiffness: 260, damping: 18, delay: 0.25 }}
      className={cn("inline-flex flex-col items-center border-[3px] px-5 py-2 leading-none", tone)}
      role="img"
      aria-label={`Verdict: ${verdict}`}
    >
      <span className={cn("font-black tracking-[-0.02em] wide", word === "REFUSED" ? "text-3xl sm:text-5xl" : "text-4xl sm:text-6xl")}>{word}</span>
      {verdict === "PASS_MINOR" && <span className="mt-1 text-[11px] font-bold uppercase tracking-[0.12em]">with minor defects</span>}
      {verdict === "REFUSED" && <span className="mt-1 text-[11px] font-bold uppercase tracking-[0.12em]">site could not be tested</span>}
    </motion.div>
  );
}

function Tag({ tone, children }) {
  const t = { pass: "bg-pass-wash text-pass", fail: "bg-fail-wash text-fail", warn: "bg-warn-wash text-warn", ink: "bg-wash text-ink" }[tone || "ink"];
  return <span className={cn("inline-flex items-center gap-1 rounded-[4px] px-1.5 py-0.5 text-xs font-semibold", t)}>{children}</span>;
}

function Reading({ label, value, sub, tone }) {
  const c = { bad: "text-fail", warn: "text-warn", ok: "text-pass" }[tone] || "text-ink";
  return (
    <div className="border-b border-r border-rule px-4 py-3 sm:px-5">
      <dt className="text-[13px] text-muted">{label}</dt>
      <dd className={cn("tabular mt-0.5 text-xl font-bold tracking-[-0.01em]", c)}>{value}</dd>
      {sub && <dd className="text-xs text-muted">{sub}</dd>}
    </div>
  );
}

const Btn = ({ variant = "ghost", className, ...p }) => (
  <button
    {...p}
    className={cn(
      "inline-flex min-h-10 items-center justify-center gap-2 rounded-[6px] px-4 text-sm font-semibold transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-45",
      variant === "primary" && "bg-ink text-white hover:bg-[#2b2f30]",
      variant === "ghost" && "border border-rule-strong bg-white text-ink hover:border-ink hover:bg-wash",
      variant === "link" && "min-h-0 px-0 underline decoration-rule-strong hover:decoration-ink",
      className,
    )}
  />
);

function SectionHead({ title, note, children }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 border-b-2 border-ink pb-2">
      <div>
        <h3 className="text-lg font-bold tracking-[-0.01em]">{title}</h3>
        {note && <p className="text-sm text-muted">{note}</p>}
      </div>
      {children}
    </div>
  );
}

function Elapsed() {
  const [s, setS] = useState(0);
  useEffect(() => { const t = setInterval(() => setS((x) => x + 1), 1000); return () => clearInterval(t); }, []);
  return <span className="tabular">{s}s</span>;
}

export default function Home() {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [res, setRes] = useState(null);
  const [approved, setApproved] = useState({});
  const [fix, setFix] = useState(null);
  const [history, setHistory] = useState({ audits: [], db: false });
  const [copied, setCopied] = useState("");
  const [view, setView] = useState("defects");
  const [agentMode, setAgentMode] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const top = useRef(null);

  const loadHistory = () => fetch("/api/audit").then((r) => r.json()).then(setHistory).catch(() => {});
  useEffect(() => { loadHistory(); }, []);

  async function audit(target, force = false, mode = agentMode ? "agent" : "quick") {
    const host = hostOf(target);
    if (!host) return setErr("Enter a website address, for example monzo.com");
    setUrl(target); setErr(""); setFix(null); setApproved({}); setShowHistory(false);
    const key = `pt:${host}:${mode}:${today()}`;
    // Browser cache first: an audit of this host from today is reused without a network call.
    const local = !force && store.get(key);
    if (local) { setRes({ ...local, cached: true, cacheSource: "browser" }); setView("defects"); return; }
    setBusy("audit"); setRes(null);
    top.current?.scrollIntoView({ behavior: "smooth" });
    try {
      const r = await post({ url: target, force, mode });
      const out = { ...r, cacheSource: r.cached ? "server" : null };
      setRes(out); store.set(key, r); loadHistory(); setView("defects");
    } catch (e) { setErr(`The test could not finish: ${e.message}. Check the address and try again.`); }
    setBusy("");
  }

  async function draftFixes() {
    setBusy("fix"); setErr("");
    try { setFix(await post({ action: "fix", url: res.url, auditId: res.auditId, findings: res.findings.filter((f, i) => approved[i]) })); setView("fixes"); }
    catch (e) { setErr(`Fixes could not be drafted: ${e.message}`); }
    setBusy("");
  }

  const copy = (text, id) => navigator.clipboard?.writeText(text).then(() => { setCopied(id); setTimeout(() => setCopied(""), 1500); });

  const m = useMemo(() => {
    if (!res) return null;
    const t = res.scan.trackers, v = res.findings.filter((f) => f.verified), rej = res.findings.filter((f) => !f.verified);
    const bySev = { high: 0, medium: 0, low: 0 };
    v.forEach((f) => { bySev[f.severity] = (bySev[f.severity] || 0) + 1; });
    const advisories = [
      ...(res.policy?.article13 || []).filter((c) => !c.present).map((c) => `Policy does not cover: ${c.label}`),
      ...(res.headers || []).filter((h) => !h.value).map((h) => `Response header not set: ${h.label}`),
      ...(res.policy && !res.policy.updated ? ["Policy has no last-updated date"] : []),
      ...(res.policy?.updated?.ageDays > 365 ? [`Policy last updated ${res.policy.updated.ageDays} days ago`] : []),
    ];
    return {
      trackers: t.length, gated: t.filter((x) => x.gatedByConsent).length, disclosed: t.filter((x) => x.disclosedInPolicy).length,
      verified: v, rejected: rej, bySev, precision: pct(v.length, res.findings.length), hosts: res.scan.scriptHosts.length, advisories,
      // MOT "refusal to test": nothing could be fetched, so a clean result would be a false pass.
      verdict: !res.pageBytes && !res.policyWords ? "REFUSED" : bySev.high || bySev.medium ? "FAIL" : bySev.low ? "PASS_MINOR" : "PASS",
    };
  }, [res]);

  const approvedCount = Object.values(approved).filter(Boolean).length;
  const steps = res ? [
    ["Fetch page", res.timings?.fetch], ["Fetch privacy policy", res.timings?.policy], ["Deterministic tracker scan", res.timings?.scan],
    [`Gemini analysis (${res.model})`, res.timings?.model], ["Evidence verifier", res.timings?.verify],
  ] : [];
  const counts = m ? { defects: m.verified.length, fixes: fix?.code_fixes?.length } : {};
  const landing = !res && !busy;

  return (
    <MotionConfig reducedMotion="user">
      <div ref={top} className="min-h-screen bg-paper">
        <header className="no-print sticky top-0 z-30 border-b border-rule bg-white/95 backdrop-blur-sm">
          <div className="mx-auto flex max-w-[1240px] items-center justify-between gap-4 px-4 py-3 sm:px-6">
            <button onClick={() => { setRes(null); setErr(""); }} className="flex items-center gap-2.5 text-left" aria-label="PolicyTruth home">
              <span className="grid size-8 place-items-center rounded-[6px] bg-ink text-plate"><Icon d={I.shield} size={17} /></span>
              <span className="text-lg font-extrabold tracking-[-0.02em] wide">PolicyTruth</span>
            </button>
            {res && <span className="hidden md:block"><Plate size="sm">{res.host}</Plate></span>}
            <div className="flex items-center gap-2">
              <span className={cn("hidden items-center gap-1.5 text-xs font-medium sm:inline-flex", history.db ? "text-pass" : "text-muted")}>
                <Icon d={I.db} size={13} />{history.db ? "MongoDB Atlas" : "JSON storage"}
              </span>
              <span className="hidden text-xs font-medium text-muted lg:inline">· UK GDPR · PECR</span>
              <Btn onClick={() => setShowHistory((s) => !s)} aria-expanded={showHistory} className="ml-2 min-h-9 px-3">
                <Icon d={I.list} size={15} />Test history<span className="tabular rounded-[4px] bg-wash px-1.5 text-xs">{history.audits.length}</span>
              </Btn>
            </div>
          </div>
          <AnimatePresence>
            {showHistory && (
              <motion.div
                initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                className="overflow-hidden border-t border-rule bg-white"
              >
                <div className="mx-auto max-w-[1240px] px-4 py-5 sm:px-6">
                  <History history={history} onOpen={(a) => audit(a.url || a.host, false, a.mode === "agent" ? "agent" : "quick")} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </header>

        <main className="mx-auto max-w-[1240px] px-4 sm:px-6">
          {landing && (
            <section className="grid gap-10 pb-16 pt-12 lg:grid-cols-12 lg:gap-12 lg:pt-20">
              <div className="lg:col-span-8">
                <BlurText
                  as="h1"
                  text="Does your website do what your privacy policy says?"
                  trigger="load"
                  delay={70}
                  className="max-w-[16ch] text-[clamp(2.5rem,6.2vw,5rem)] font-extrabold leading-[0.98] tracking-[-0.035em]"
                />
                <p className="mt-6 max-w-[60ch] text-lg text-muted">
                  PolicyTruth tests your site like an MOT. It records the trackers your pages actually load, reads your whole privacy policy with Gemini, and fails anything the two disagree on. A verifier throws out every claim it cannot prove, and nothing is drafted until you approve it.
                </p>
                <AuditForm url={url} setUrl={setUrl} busy={busy} onSubmit={() => audit(url)} agentMode={agentMode} setAgentMode={setAgentMode} />
                <div className="mt-5 flex flex-wrap items-center gap-2.5 text-sm text-muted">
                  <span>Try a test on</span>
                  {EXAMPLES.map((e) => (
                    <button key={e} onClick={() => audit(e)} disabled={!!busy} className="transition-transform duration-150 hover:-translate-y-0.5">
                      <Plate size="sm">{e}</Plate>
                    </button>
                  ))}
                </div>
              </div>
              <aside className="lg:col-span-4 lg:pt-3">
                <Manual />
              </aside>
            </section>
          )}

          {err && (
            <div role="alert" className="mt-6 flex items-start gap-3 rounded-[6px] border-2 border-fail bg-fail-wash px-4 py-3 text-sm font-medium text-fail">
              <Icon d={I.alert} size={18} className="mt-0.5 shrink-0" />{err}
            </div>
          )}

          {busy === "audit" && <Testing url={url} agent={agentMode} />}

          {res && m && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }} className="pb-24 pt-8">
              {(res.cached || res.changes) && (
                <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted no-print">
                  {res.cached && <span className="inline-flex items-center gap-1.5"><Icon d={I.clock} size={14} />Today&apos;s test from {res.cacheSource === "browser" ? "this browser" : res.storage === "json" ? "JSON storage" : "MongoDB"} ({new Date(res.createdAt).toLocaleTimeString()}). No new model call.</span>}
                  {res.changes && <span className="inline-flex items-center gap-1.5"><Icon d={I.refresh} size={14} />Since {new Date(res.changes.since).toLocaleDateString()} (score {res.changes.previousScore ?? "?"}): {res.changes.added.length ? `added ${res.changes.added.join(", ")}` : "no new trackers"}{res.changes.removed.length ? `; removed ${res.changes.removed.join(", ")}` : ""}.</span>}
                </div>
              )}

              <Certificate res={res} m={m} fix={fix} readings={<Readings res={res} m={m} />} onRerun={() => audit(res.url, true, res.mode === "agent" ? "agent" : "quick")} busy={busy} />


              <nav className="no-print sticky top-[61px] z-20 mt-10 flex gap-1 overflow-x-auto border-b border-rule bg-white py-2" aria-label="Certificate sections" role="tablist">
                <AnimatedBackground defaultValue={view} onValueChange={(id) => id && setView(id)} className="rounded-[6px] bg-ink" transition={{ type: "spring", bounce: 0.15, duration: 0.45 }}>
                  {VIEWS.map(([id, label]) => (
                    <button
                      key={id} data-id={id} role="tab" aria-selected={view === id}
                      className={cn("shrink-0 rounded-[6px] px-4 py-2 text-sm font-semibold transition-colors duration-200", view === id ? "text-white" : "text-muted hover:text-ink")}
                    >
                      {label}{counts[id] != null && <span className={cn("tabular rounded-[4px] px-1.5 text-xs", view === id ? "bg-white/20" : "bg-wash")}>{counts[id]}</span>}
                    </button>
                  ))}
                </AnimatedBackground>
              </nav>

              <AnimatePresence mode="wait">
                <motion.section key={view} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }} className="pt-8">
                  {view === "defects" && <Defects res={res} m={m} approved={approved} setApproved={setApproved} approvedCount={approvedCount} busy={busy} draftFixes={draftFixes} />}
                  {view === "inspection" && <Inspection res={res} m={m} />}
                  {view === "log" && <TestLog res={res} steps={steps} />}
                  {view === "fixes" && <Fixes fix={fix} copy={copy} copied={copied} goDefects={() => setView("defects")} />}
                </motion.section>
              </AnimatePresence>
            </motion.div>
          )}

          {landing && <HowItWorks />}
          {landing && history.audits.length > 0 && (
            <section className="border-t border-rule py-14">
              <History history={history} onOpen={(a) => audit(a.url || a.host, false, a.mode === "agent" ? "agent" : "quick")} />
            </section>
          )}
        </main>

        <footer className="border-t border-rule">
          <div className="mx-auto flex max-w-[1240px] flex-wrap justify-between gap-2 px-4 py-6 text-sm text-muted sm:px-6">
            <span>PolicyTruth drafts suggestions for human review. It is not legal advice.</span>
            <span>Built with Gemini and MongoDB Atlas at Encode London 2026.</span>
          </div>
        </footer>
      </div>
    </MotionConfig>
  );
}

function AuditForm({ url, setUrl, busy, onSubmit, agentMode, setAgentMode }) {
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(); }} className="mt-9">
      <label htmlFor="domain" className="text-sm font-semibold">Website to test</label>
      <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-stretch">
        <div className="plate flex flex-1 items-stretch overflow-hidden focus-within:shadow-[0_0_0_3px_#ffd400,0_4px_0_3px_#0b0c0c]">
          <span className="flex w-11 shrink-0 items-center justify-center bg-band text-sm font-bold text-white wide" aria-hidden="true">UK</span>
          <input
            id="domain" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="YOURSITE.CO.UK" required autoComplete="url" inputMode="url" spellCheck={false}
            className="w-full min-w-0 bg-transparent px-3 py-3.5 text-[clamp(1.1rem,5.6vw,1.875rem)] font-extrabold uppercase sm:px-4 tracking-[0.04em] text-plate-ink outline-none wide placeholder:text-plate-ink/55 focus-visible:shadow-none sm:text-3xl"
          />
        </div>
        <Btn variant="primary" disabled={!!busy} className="min-h-14 px-7 text-base">
          {busy === "audit" ? "Testing…" : <>Start test<Icon d={I.arrow} size={18} /></>}
        </Btn>
      </div>
      <label className="mt-4 flex max-w-[62ch] cursor-pointer items-start gap-3 text-sm">
        <span className="relative mt-0.5 inline-flex shrink-0">
          <input type="checkbox" checked={agentMode} onChange={(e) => setAgentMode(e.target.checked)} className="peer sr-only" />
          <span className="h-6 w-11 rounded-full border-2 border-ink bg-white transition-colors peer-checked:bg-ink peer-focus-visible:outline peer-focus-visible:outline-3 peer-focus-visible:outline-plate" />
          <span className="absolute left-1 top-1 size-4 rounded-full bg-ink transition-transform duration-200 ease-out-expo peer-checked:translate-x-5 peer-checked:bg-white" />
        </span>
        <span className="text-muted"><b className="text-ink">Agent mode.</b> Gemini plans the test, inspects up to 6 pages on the site, reads every policy it finds, and revises its findings when the verifier rejects them.</span>
      </label>
    </form>
  );
}

function Manual() {
  const items = [
    ["Trackers loaded", "15 known vendors matched in the page source"],
    ["Consent gating", "Does each tracker wait for one of 8 consent managers?"],
    ["Policy disclosure", "Gemini reads the full policy and checks each vendor is named"],
    ["Evidence verifier", "Every model claim is checked against source and policy text"],
    ["UK GDPR Article 13", "Required items present in the policy"],
    ["Policy quality", "Readability, length and last-updated date"],
    ["Privacy headers", "Referrer-Policy, Permissions-Policy and others"],
  ];
  return (
    <div className="border-2 border-ink">
      <div className="flex items-center justify-between bg-ink px-4 py-2.5 text-white">
        <span className="text-sm font-bold uppercase tracking-[0.1em] wide">What we test</span>
        <Icon d={I.shield} size={16} className="text-plate" />
      </div>
      <ol>
        {items.map(([t, d], i) => (
          <li key={t} className="grid grid-cols-[2rem_1fr] gap-x-2 border-t border-rule px-4 py-3 first:border-t-0">
            <span className="tabular text-sm font-bold text-muted">{String(i + 1).padStart(2, "0")}</span>
            <span><b className="block text-[15px] leading-snug">{t}</b><span className="text-sm text-muted">{d}</span></span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function HowItWorks() {
  const steps = [
    ["Scan", "A deterministic scanner reads the page source and lists every tracker and consent manager it finds."],
    ["Read", "Gemini reads the entire privacy policy and compares it with what the site loads."],
    ["Verify", "A verifier checks each claim against the evidence. Anything unproven is rejected and shown to you."],
    ["Approve", "You tick the defects you agree with. Only then does PolicyTruth draft code and policy fixes."],
  ];
  return (
    <section className="border-t-2 border-ink py-14">
      <h2 className="max-w-[24ch] text-3xl font-extrabold tracking-[-0.025em] sm:text-4xl">A test you can check line by line</h2>
      <ol className="mt-10 grid gap-px bg-rule sm:grid-cols-2 lg:grid-cols-4">
        {steps.map(([t, d], i) => (
          <li key={t} className="bg-white p-6 pl-0 sm:pl-6 sm:first:pl-0">
            <h3 className="flex items-baseline gap-3 text-2xl font-extrabold tracking-[-0.02em] wide"><span className="tabular text-rule-strong">{i + 1}</span>{t}</h3>
            <p className="mt-2 text-[15px] text-muted">{d}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Testing({ url, agent }) {
  const steps = agent
    ? ["Planning the test", "Inspecting pages on the site", "Reading every privacy policy found", "Checking findings against evidence", "Revising rejected findings"]
    : ["Fetching the page and policy", "Scanning for trackers", "Asking Gemini to compare", "Verifying every claim"];
  return (
    <section aria-live="polite" className="grid gap-8 py-16 lg:grid-cols-12">
      <div className="lg:col-span-5">
        <Plate>{hostOf(url) || url}</Plate>
        <h2 className="mt-6 text-3xl font-extrabold tracking-[-0.025em]">Test in progress</h2>
        <p className="mt-2 text-muted">{agent ? "Agent mode usually takes 30 to 90 seconds." : "This usually takes about 25 seconds."} Elapsed <Elapsed /></p>
      </div>
      <ol className="border-t-2 border-ink lg:col-span-7">
        {steps.map((s) => (
          <li key={s} className="flex items-center gap-3 border-b border-rule py-3.5">
            <span className="size-2 shrink-0 rounded-full bg-ink" />
            <TextShimmer as="span" duration={2.2} className="text-[15px] font-semibold">{s}</TextShimmer>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Readings({ res, m }) {
  return (
    <dl className="-mb-px -mr-px grid grid-cols-2 border-t-2 border-ink sm:grid-cols-3 lg:grid-cols-6">
      <Reading label="Trackers found" value={m.trackers} sub={`${m.hosts} third-party script hosts`} />
      <Reading label="Wait for consent" value={`${pct(m.gated, m.trackers)}%`} sub={`${m.gated} of ${m.trackers}`} tone={!m.trackers ? null : m.gated < m.trackers ? "bad" : "ok"} />
      <Reading label="Named in policy" value={`${pct(m.disclosed, m.trackers)}%`} sub={`${m.disclosed} of ${m.trackers} vendor${m.trackers === 1 ? "" : "s"}`} tone={!m.trackers ? null : m.disclosed < m.trackers ? "warn" : "ok"} />
      <Reading label="Consent manager" value={res.scan.cmp[0] || "None"} sub={res.scan.cmp.length > 1 ? res.scan.cmp.slice(1).join(", ") : "in page source"} tone={res.scan.cmp.length ? "ok" : "bad"} />
      <Reading label="Claims rejected" value={m.rejected.length} sub={`${m.precision}% of model claims survived`} />
      <Reading label="Test time" value={res.timings?.total ? `${(res.timings.total / 1000).toFixed(1)}s` : "-"} sub={`page ${Math.round((res.pageBytes || 0) / 1024)} KB`} />
    </dl>
  );
}

// Gemini's risk summary can run to a paragraph: lead with its first sentence, keep the rest at body weight.
function RiskSummary({ text = "" }) {
  const cut = text.search(/\.\s/);
  const lead = cut > 0 ? text.slice(0, cut + 1) : text, rest = cut > 0 ? text.slice(cut + 2) : "";
  return (
    <div className="mt-6 max-w-[65ch]">
      <h2 className="text-lg font-bold leading-snug tracking-[-0.01em] sm:text-[1.375rem]">{lead}</h2>
      {rest && <p className="mt-2">{rest}</p>}
    </div>
  );
}

function Certificate({ res, m, fix, readings, onRerun, busy }) {
  const [menu, setMenu] = useState(false);
  return (
    <article className="overflow-hidden border-2 border-ink">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 bg-ink px-5 py-2.5 text-[13px] text-white/85">
        <span className="font-bold uppercase tracking-[0.12em] text-white wide">Privacy test certificate</span>
        <span className="tabular">
          {new Date(res.createdAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}
          {res.auditId && <> · Test {String(res.auditId).slice(-8).toUpperCase()}</>}
          {" "}· {res.mode === "agent" ? "Agent mode" : "Quick test"}
        </span>
      </div>
      <div className="grid gap-8 p-5 sm:p-8 lg:grid-cols-[1fr_auto]">
        <div className="min-w-0">
          <Plate>
            <DecryptedText text={res.host} animateOn="view" sequential speed={35} characters="ABCDEFGHJKLMNPRSTUVWXYZ0123456789" />
          </Plate>
          <RiskSummary text={res.risk_summary} />
          <p className="mt-3 max-w-[75ch] text-[15px] text-muted"><b className="text-ink">Policy claims.</b> {res.policy_summary}</p>
          <div className="no-print mt-6 flex flex-wrap gap-2">
            <Btn onClick={onRerun} disabled={!!busy}><Icon d={I.refresh} size={15} />Re-test now</Btn>
            <div className="relative">
              <Btn onClick={() => setMenu((x) => !x)} aria-expanded={menu} aria-haspopup="menu"><Icon d={I.down} size={15} />Export<Icon d={I.chevron} size={14} /></Btn>
              {menu && (
                <div role="menu" className="absolute left-0 top-full z-20 mt-1 w-56 border-2 border-ink bg-white py-1 shadow-[0_8px_24px_rgb(11_12_12/0.12)]" onMouseLeave={() => setMenu(false)}>
                  {[
                    ["Report (.md)", () => download(`policytruth-${res.host}.md`, markdown(res, fix), "text/markdown")],
                    ["Raw data (.json)", () => download(`policytruth-${res.host}.json`, JSON.stringify({ ...res, fix }, null, 2), "application/json")],
                    ["Print or save as PDF", () => window.print()],
                  ].map(([l, fn]) => (
                    <button key={l} role="menuitem" onClick={() => { setMenu(false); fn(); }} className="block w-full px-4 py-2 text-left text-sm font-medium hover:bg-wash">{l}</button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="order-first flex flex-wrap items-center gap-5 border-b border-rule pb-6 sm:gap-8 lg:order-none lg:flex-col lg:items-end lg:border-b-0 lg:border-l lg:pb-0 lg:pl-8">
          <Verdict verdict={m.verdict} />
          <div className="lg:text-right">
            <div className="flex items-baseline gap-1 lg:justify-end">
              {m.verdict === "REFUSED" ? <span className="text-6xl font-black text-muted">–</span> : <CountUp to={res.score ?? 0} duration={1.4} trigger="load" className="tabular text-6xl font-black tracking-[-0.03em]" />}
              <span className="text-lg font-semibold text-muted">/100</span>
            </div>
            <div className="text-sm text-muted">Grade <b className="text-ink">{res.grade ?? "?"}</b><span className="lg:hidden"> · {m.verified.length} verified defect{m.verified.length === 1 ? "" : "s"}</span></div>
          </div>
          <dl className="hidden w-56 border-t-2 border-ink text-sm lg:block">
            {[["Dangerous", m.bySev.high, "text-fail"], ["Major", m.bySev.medium, "text-fail"], ["Minor", m.bySev.low, "text-ink"], ["Advisories", m.advisories.length, "text-warn"], ["Not reported", m.rejected.length, "text-muted"]].map(([k, v, c]) => (
              <div key={k} className="flex justify-between border-b border-rule py-1.5"><dt className="text-muted">{k}</dt><dd className={cn("tabular font-bold", v ? c : "text-muted")}>{v}</dd></div>
            ))}
          </dl>
        </div>
      </div>
      {readings}
    </article>
  );
}

function Defects({ res, m, approved, setApproved, approvedCount, busy, draftFixes }) {
  let n = 0;
  return (
    <div className="grid gap-12">
      <p className="max-w-[70ch] text-muted">Each defect is backed by evidence from the page source and the policy text. Tick the ones you want fixed. Nothing on your site is changed.</p>
      {CATEGORY.map(([sev, name, note]) => {
        const list = m.verified.filter((f) => f.severity === sev);
        if (!list.length) return null;
        return (
          <div key={sev}>
            <SectionHead title={<span className="flex items-center gap-3"><span className={cn(sev === "low" ? "text-ink" : "text-fail")}>{name}</span><span className="tabular text-base font-semibold text-muted">{list.length}</span></span>} note={note} />
            <ol>
              {list.map((f) => {
                const i = res.findings.indexOf(f);
                n += 1;
                return (
                  <li key={i}>
                    <label className={cn("grid grid-cols-[2rem_1.5rem_1fr] gap-x-3 border-b border-rule py-5 transition-colors duration-150 sm:grid-cols-[2.5rem_1.5rem_1fr]", approved[i] ? "bg-pass-wash" : "hover:bg-wash/60")}>
                      <span className="tabular pl-1 pt-0.5 text-sm font-bold text-muted">{String(n).padStart(2, "0")}</span>
                      <input type="checkbox" checked={!!approved[i]} onChange={(e) => setApproved({ ...approved, [i]: e.target.checked })} className="mt-1 size-5 accent-ink" aria-label={`Approve fix for ${f.vendor}`} />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-baseline gap-x-2">
                          <b className="text-[17px]">{f.vendor}</b>
                          <span className="text-muted">{ISSUE[f.issue] || f.issue}</span>
                        </div>
                        <p className="mt-1 max-w-[75ch]">{f.explanation}</p>
                        {(f.evidence || f.policy_quote) && (
                          <dl className="mt-3 grid gap-2 text-sm">
                            {f.evidence && <div className="grid gap-1 sm:grid-cols-[7rem_1fr]"><dt className="font-semibold text-muted">Page source</dt><dd className="min-w-0"><code className="block overflow-x-auto whitespace-pre-wrap break-all rounded-[4px] bg-wash px-2 py-1">{f.evidence}</code></dd></div>}
                            {f.policy_quote && <div className="grid gap-1 sm:grid-cols-[7rem_1fr]"><dt className="font-semibold text-muted">Policy says</dt><dd><q className="italic">{f.policy_quote}</q></dd></div>}
                          </dl>
                        )}
                      </div>
                    </label>
                  </li>
                );
              })}
            </ol>
          </div>
        );
      })}
      {!m.verified.length && (m.verdict === "REFUSED"
        ? <p className="border-y-2 border-ink py-6 text-lg font-semibold">The site could not be fetched, so nothing was tested. A score here is not a pass. Try again later or test another page.</p>
        : <p className="border-y-2 border-pass py-6 text-lg font-semibold text-pass">No verified defects. The site and the policy agree on every tracker we found.</p>)}

      {!!m.rejected.length && (
        <div>
          <SectionHead title={<span className="flex items-center gap-3">Not reported<span className="tabular text-base font-semibold text-muted">{m.rejected.length}</span></span>} note="Gemini proposed these, but the verifier found no supporting evidence, so they do not count against the site." />
          <ul>
            {m.rejected.map((f, i) => (
              <li key={i} className="flex items-start gap-3 border-b border-rule py-3 text-sm">
                <Icon d={I.x} size={15} className="mt-0.5 shrink-0 text-muted" />
                <span><s className="decoration-fail decoration-2"><b>{f.vendor}</b> · {ISSUE[f.issue] || f.issue}</s><span className="block text-muted">{f.rejected_because.join("; ")}</span></span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!!m.advisories.length && (
        <div>
          <SectionHead title={<span className="flex items-center gap-3">Advisories<span className="tabular text-base font-semibold text-muted">{m.advisories.length}</span></span>} note="Not defects. Monitor these and repair if needed. Keyword checks, not proof of a breach." />
          <ul className="columns-1 gap-8 md:columns-2">
            {m.advisories.map((a) => <li key={a} className="break-inside-avoid border-b border-rule py-2.5 text-sm">{a}</li>)}
          </ul>
        </div>
      )}

      {!!m.verified.length && (
        <div className="no-print sticky bottom-4 z-10 flex flex-wrap items-center justify-between gap-3 border-2 border-ink bg-white px-4 py-3">
          <span className="text-sm"><b className="tabular">{approvedCount}</b> of {m.verified.length} defects approved</span>
          <div className="flex gap-2">
            <Btn onClick={() => setApproved(Object.fromEntries(m.verified.map((f) => [res.findings.indexOf(f), true])))}>Approve all</Btn>
            <Btn variant="primary" disabled={!!busy || !approvedCount} onClick={draftFixes}>
              {busy === "fix" ? <TextShimmer as="span" className="[--base-color:#c9c9c9] [--base-gradient-color:#fff]">Drafting fixes…</TextShimmer> : `Draft ${approvedCount || ""} fix${approvedCount === 1 ? "" : "es"}`}
            </Btn>
          </div>
        </div>
      )}
    </div>
  );
}

function Inspection({ res, m }) {
  return (
    <div className="grid gap-14">
      <div>
        <SectionHead title="Tracker inventory" note={`${m.trackers} tracker${m.trackers === 1 ? "" : "s"} matched in the page source`} />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead><tr className="border-b border-rule text-muted"><th className="py-2.5 pr-4 font-semibold">Vendor</th><th className="py-2.5 pr-4 font-semibold">Consent</th><th className="py-2.5 font-semibold">In policy</th></tr></thead>
            <tbody>
              {res.scan.trackers.map((t) => (
                <tr key={t.id} className="border-b border-rule align-top">
                  <td className="py-3 pr-4"><b className="text-[15px]">{t.vendor}</b><code className="mt-0.5 block text-xs text-muted">{t.matched}</code></td>
                  <td className="py-3 pr-4">{t.gatedByConsent ? <Tag tone="pass"><Icon d={I.check} size={12} />Waits for consent</Tag> : <Tag tone="fail"><Icon d={I.x} size={12} />Fires before consent</Tag>}</td>
                  <td className="py-3">{t.disclosedInPolicy ? <Tag tone="pass"><Icon d={I.check} size={12} />“{t.disclosedTerm}”</Tag> : <Tag tone="warn"><Icon d={I.x} size={12} />Not named</Tag>}</td>
                </tr>
              ))}
              {!res.scan.trackers.length && <tr><td colSpan="3" className="py-4 text-muted">No known trackers in the page source.</td></tr>}
            </tbody>
          </table>
        </div>
        {!!m.hosts && (
          <details className="mt-4 text-sm">
            <summary className="inline-flex items-center gap-1 font-semibold underline decoration-rule-strong underline-offset-4">All third-party script hosts ({m.hosts})<Icon d={I.chevron} size={14} /></summary>
            <div className="mt-3 flex flex-wrap gap-1.5">{res.scan.scriptHosts.map((h) => <code key={h} className="rounded-[4px] bg-wash px-2 py-0.5 text-xs">{h}</code>)}</div>
          </details>
        )}
      </div>

      <div className="grid gap-14 lg:grid-cols-2 lg:gap-10">
        <div>
          <SectionHead title="UK GDPR Article 13" note={res.policy ? `${res.policy.coverage}% coverage · keyword check, not proof of a breach` : "Re-run this test to see policy checks"} />
          <ul>
            {res.policy?.article13.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 border-b border-rule py-2.5 text-sm">
                <span>{c.label}</span>{c.present ? <Tag tone="pass"><Icon d={I.check} size={12} />Found</Tag> : <Tag tone="fail"><Icon d={I.x} size={12} />Missing</Tag>}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <SectionHead title="Policy quality" />
          <dl className="text-sm">
            {[
              ["Source", res.policyUrl ? <a href={res.policyUrl} target="_blank" rel="noreferrer" className="break-all underline">{res.policyUrl}</a> : "not found"],
              ["Length", res.policyWords ? `${res.policyWords.toLocaleString()} words · about ${Math.ceil(res.policyWords / 230)} min read` : "policy page unreachable"],
              ["Readability", res.policy?.readability ? `${res.policy.readability.score} Flesch (${res.policy.readability.label})` : "n/a"],
              ["Last updated", res.policy?.updated ? `${res.policy.updated.date} (${res.policy.updated.ageDays} days ago)` : "not stated"],
            ].map(([k, v]) => <div key={k} className="grid grid-cols-[8rem_1fr] gap-3 border-b border-rule py-2.5"><dt className="font-semibold text-muted">{k}</dt><dd className="min-w-0">{v}</dd></div>)}
          </dl>
          <h4 className="mt-8 text-sm font-bold">Privacy response headers</h4>
          {!res.headers?.length && <p className="mt-2 text-sm text-muted">Not recorded in this test. Re-test to check headers.</p>}
          <ul className="mt-1">
            {res.headers?.map((h) => (
              <li key={h.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-rule py-2.5 text-sm">
                <span>{h.label}{h.value && <code className="ml-2 text-xs text-muted">{h.value.slice(0, 60)}</code>}</span>
                {h.value ? <Tag tone="pass"><Icon d={I.check} size={12} />Set</Tag> : <Tag tone="warn"><Icon d={I.x} size={12} />Missing</Tag>}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function TestLog({ res, steps }) {
  return (
    <div className="grid gap-14">
      {res.trace && (
        <div>
          <SectionHead
            title="Agent trace"
            note={`${res.trace.length} steps · ${res.pagesInspected?.length || 0} pages · ${res.policyUrls?.length || 0} policies${res.revised ? " · revised after verifier feedback" : ""}. The agent can only fetch pages on the tested site.`}
          />
          <ol className="relative">
            {res.trace.map((t, i) => (
              <li key={i} className="grid grid-cols-[2.5rem_1fr] gap-x-3 border-b border-rule py-3.5 sm:grid-cols-[2.5rem_11rem_1fr]">
                <span className="tabular pt-0.5 text-sm font-bold text-muted">{String(i + 1).padStart(2, "0")}</span>
                <code className={cn("self-start justify-self-start rounded-[4px] px-1.5 py-0.5 text-xs font-medium", t.tool === "submit_findings" ? "bg-ink text-white" : "bg-wash")}>{t.tool}</code>
                <div className="col-start-2 mt-1.5 min-w-0 text-sm sm:col-start-3 sm:mt-0">
                  {t.url && <code className="block break-all text-xs text-muted">{t.url}</code>}
                  {t.reason && <p>{t.reason}</p>}
                  <p className="text-xs text-muted">{t.summary?.replace(/^1 trackers\b/, "1 tracker")}{t.ms != null ? ` · ${t.ms} ms` : ""}</p>
                </div>
              </li>
            ))}
          </ol>
          {res.unchecked && <p className="mt-4 text-sm text-muted"><b className="text-ink">Agent says it did not check:</b> {res.unchecked}</p>}
        </div>
      )}
      <div className="grid gap-14 lg:grid-cols-2 lg:gap-10">
        <div>
          <SectionHead title="Pipeline" note="Each stage and how long it took" />
          <ol>
            {steps.map(([name, t]) => (
              <li key={name} className="flex items-center gap-3 border-b border-rule py-2.5 text-sm">
                <span className="grid size-5 place-items-center rounded-full bg-ink text-white"><Icon d={I.check} size={11} /></span>
                <span className="flex-1">{name}</span><span className="tabular text-muted">{t != null ? `${t} ms` : "cached"}</span>
              </li>
            ))}
            <li className="flex items-center gap-3 border-b border-rule py-2.5 text-sm">
              <span className="grid size-5 place-items-center rounded-full bg-ink text-white"><Icon d={I.db} size={11} /></span>
              <span className="flex-1">Stored for audit trail</span><span className="text-muted">{res.storage === "json" ? "JSON storage" : res.auditId ? "MongoDB" : "browser"}</span>
            </li>
          </ol>
        </div>
        <div>
          <SectionHead title="Run log" />
          <div className="mt-3 max-h-80 overflow-auto rounded-[6px] bg-wash p-4 font-mono text-xs leading-relaxed">{res.log.map((l, i) => <div key={i}>{l}</div>)}</div>
        </div>
      </div>
    </div>
  );
}

// Gemini writes the policy text in light markdown; render **bold**, `code` and "* " bullets, copy keeps the raw text.
const inlineMd = (text = "") => text.replace(/^#{1,6}\s+(.+)$/gm, "**$1**").split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((p, i) =>
  p.startsWith("**") && p.endsWith("**") && p.length > 4 ? <b key={i}>{p.slice(2, -2)}</b> : p.startsWith("`") && p.endsWith("`") && p.length > 2 ? <code key={i} className="rounded-[3px] bg-white px-1">{p.slice(1, -1)}</code> : p.replace(/^(\s*)\* /gm, "$1• "));

function Fixes({ fix, copy, copied, goDefects }) {
  if (!fix) return (
    <div className="max-w-[60ch] border-y border-rule py-10">
      <h3 className="text-xl font-bold">No fixes drafted yet</h3>
      <p className="mt-2 text-muted">Approve defects first. PolicyTruth only drafts fixes for the defects you agree with.</p>
      <Btn className="mt-5" onClick={goDefects}>Go to defects<Icon d={I.arrow} size={15} /></Btn>
    </div>
  );
  return (
    <div className="grid gap-12">
      <div>
        <SectionHead title="Draft fixes" note="For human review before shipping" />
        <p className="mt-4 max-w-[75ch]">{inlineMd(fix.summary)}</p>
      </div>
      {fix.code_fixes?.map((c, i) => (
        <div key={i}>
          <div className="flex flex-wrap items-center justify-between gap-2"><b className="text-[17px]">{c.tracker_id}</b><Btn onClick={() => copy(c.snippet, `c${i}`)} className="min-h-8 px-3"><Icon d={I.copy} size={14} />{copied === `c${i}` ? "Copied" : "Copy"}</Btn></div>
          <p className="mt-1 max-w-[75ch] text-sm text-muted">{inlineMd(c.explanation)}</p>
          <pre className="mt-3 overflow-x-auto rounded-[6px] bg-ink p-4 text-[13px] leading-relaxed text-[#f3f4f4]">{c.snippet}</pre>
        </div>
      ))}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2"><b className="text-[17px]">Privacy policy addition</b><Btn onClick={() => copy(fix.policy_redline, "p")} className="min-h-8 px-3"><Icon d={I.copy} size={14} />{copied === "p" ? "Copied" : "Copy"}</Btn></div>
        <div className="mt-3 max-w-[80ch] whitespace-pre-wrap rounded-[6px] border-2 border-ink bg-wash p-5 text-[15px] leading-relaxed">{inlineMd(fix.policy_redline)}</div>
      </div>
    </div>
  );
}

function History({ history, onOpen }) {
  const gradeTone = (g) => (g === "A" || g === "B" ? "text-pass" : g === "C" ? "text-warn" : "text-fail");
  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-xl font-extrabold tracking-[-0.02em]">Test history</h2>
        <p className="text-sm text-muted">{history.db ? "Stored in MongoDB Atlas" : "MongoDB is unreachable, so tests are stored as JSON on the server"}. Tests from today open instantly.</p>
      </div>
      {!history.audits.length && <p className="mt-4 text-muted">No tests yet. Run one above.</p>}
      <ul className="mt-4 grid gap-px bg-rule sm:grid-cols-2 lg:grid-cols-3">
        {history.audits.map((a) => (
          <li key={String(a.id) + a.createdAt} className="bg-white">
            <button onClick={() => onOpen(a)} className="flex w-full items-center gap-4 px-1 py-3 text-left transition-colors duration-150 hover:bg-wash sm:px-3">
              <span className={cn("tabular w-8 text-center text-2xl font-black wide", gradeTone(a.grade))}>{a.grade || "?"}</span>
              <span className="min-w-0 flex-1">
                <b className="block truncate">{a.host}{a.mode === "agent" ? <span className="font-medium text-muted"> · agent</span> : ""}</b>
                <span className="text-xs text-muted">{new Date(a.createdAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })} · {a.verified} defect{a.verified === 1 ? "" : "s"}{a.approved ? " · fixed" : ""}</span>
              </span>
              <Icon d={I.arrow} size={15} className="text-muted" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
