// Deterministic policy checks: UK GDPR Article 13 coverage, readability, freshness, privacy headers.

export const ARTICLE13 = [
  { id: "controller", label: "Identity of the data controller", re: /\b(data controller|controller of (your|the) (personal )?data|we are the controller)\b/i },
  { id: "contact", label: "Contact details or DPO", re: /\b(data protection officer|dpo|privacy@|contact us at|email us at)\b/i },
  { id: "purposes", label: "Purposes of processing", re: /\b(we use (your )?(personal )?(data|information) (to|for)|purposes? (of|for) (which|processing))\b/i },
  { id: "lawful_basis", label: "Lawful basis", re: /\b(lawful basis|legal basis|legitimate interests?|performance of a contract)\b/i },
  { id: "retention", label: "Retention period", re: /\b(retain|retention|keep your (personal )?(data|information) for|stored for)\b/i },
  { id: "rights", label: "Data subject rights", re: /\b(right (of|to) access|right to (erasure|rectification|object|data portability)|subject access request)\b/i },
  { id: "withdraw", label: "Right to withdraw consent", re: /\bwithdraw (your )?consent\b/i },
  { id: "ico", label: "Right to complain to the ICO", re: /\b(information commissioner|ico\.org\.uk|\bico\b|supervisory authority)\b/i },
  { id: "transfers", label: "International transfers", re: /\b(international transfers?|outside (the )?(uk|eea|european economic area)|standard contractual clauses|adequacy)\b/i },
];

const syllables = (w) => Math.max(1, (w.toLowerCase().replace(/[^a-z]/g, "").replace(/e$/, "").match(/[aeiouy]+/g) || []).length);

export function readability(text) {
  const words = (text.match(/[A-Za-z]+/g) || []).slice(0, 20000);
  const sentences = Math.max(1, (text.slice(0, 200000).match(/[.!?]+(\s|$)/g) || []).length);
  if (words.length < 300) return null;
  const syl = words.reduce((a, w) => a + syllables(w), 0);
  const score = Math.round(206.835 - 1.015 * (words.length / sentences) - 84.6 * (syl / words.length));
  const clamped = Math.max(0, Math.min(100, score));
  const label = clamped >= 60 ? "Plain English" : clamped >= 50 ? "Fairly difficult" : clamped >= 30 ? "Difficult" : "Very difficult";
  return { score: clamped, label };
}

const MONTHS = "january|february|march|april|may|june|july|august|september|october|november|december";
export function lastUpdated(text, now = new Date()) {
  const m = text.match(new RegExp(`(last (updated|revised|modified)|effective( date)?|updated)[:\\s]*(on\\s)?((\\d{1,2}(st|nd|rd|th)?\\s(${MONTHS})|(${MONTHS})\\s\\d{1,2}(st|nd|rd|th)?,?)\\s\\d{4}|\\d{1,2}[/.-]\\d{1,2}[/.-]\\d{4}|\\d{4}-\\d{2}-\\d{2})`, "i"));
  if (!m) return null;
  const raw = m[5].replace(/(\d)(st|nd|rd|th)/, "$1");
  const d = /^\d{1,2}[/.-]\d{1,2}[/.-]\d{4}$/.test(raw) ? new Date(raw.replace(/(\d+)[/.-](\d+)[/.-](\d+)/, "$3-$2-$1")) : new Date(raw);
  if (isNaN(d)) return null;
  return { date: d.toISOString().slice(0, 10), ageDays: Math.max(0, Math.round((now - d) / 86400000)) };
}

export function policyChecks(text) {
  const items = ARTICLE13.map((c) => ({ id: c.id, label: c.label, present: !!text && c.re.test(text) }));
  return { article13: items, coverage: Math.round((items.filter((i) => i.present).length / items.length) * 100), readability: text ? readability(text) : null, updated: text ? lastUpdated(text) : null };
}

export function privacyHeaders(headers) {
  const h = (k) => headers?.get?.(k) || null;
  return [
    { id: "referrer", label: "Referrer-Policy", value: h("referrer-policy") },
    { id: "permissions", label: "Permissions-Policy", value: h("permissions-policy") },
    { id: "hsts", label: "Strict-Transport-Security", value: h("strict-transport-security") },
  ];
}
