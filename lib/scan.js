// Deterministic evidence layer: what the page actually loads, independent of the model.

export const TRACKERS = [
  { id: "meta_pixel", vendor: "Meta Pixel", names: ["facebook", "meta"], patterns: ["connect.facebook.net", "fbq("] },
  { id: "google_analytics", vendor: "Google Analytics", names: ["google analytics", "google"], patterns: ["google-analytics.com", "googletagmanager.com/gtag/js", "gtag("] },
  { id: "google_tag_manager", vendor: "Google Tag Manager", names: ["google tag manager", "google"], patterns: ["googletagmanager.com/gtm.js", "googletagmanager.com/ns.html"] },
  { id: "google_ads", vendor: "Google Ads / DoubleClick", names: ["google ads", "doubleclick", "google"], patterns: ["googleadservices.com", "googlesyndication.com", "doubleclick.net"] },
  { id: "tiktok_pixel", vendor: "TikTok Pixel", names: ["tiktok"], patterns: ["analytics.tiktok.com", "ttq.load"] },
  { id: "linkedin_insight", vendor: "LinkedIn Insight Tag", names: ["linkedin"], patterns: ["snap.licdn.com", "_linkedin_partner_id"] },
  { id: "x_pixel", vendor: "X (Twitter) Pixel", names: ["twitter", " x "], patterns: ["static.ads-twitter.com", "twq("] },
  { id: "hotjar", vendor: "Hotjar", names: ["hotjar"], patterns: ["static.hotjar.com", "hotjar.com"] },
  { id: "clarity", vendor: "Microsoft Clarity", names: ["clarity", "microsoft"], patterns: ["clarity.ms"] },
  { id: "segment", vendor: "Segment", names: ["segment"], patterns: ["cdn.segment.com"] },
  { id: "mixpanel", vendor: "Mixpanel", names: ["mixpanel"], patterns: ["cdn.mxpnl.com", "mixpanel"] },
  { id: "hubspot", vendor: "HubSpot", names: ["hubspot"], patterns: ["js.hs-scripts.com", "js.hs-analytics.net", "hs-banner.com"] },
  { id: "intercom", vendor: "Intercom", names: ["intercom"], patterns: ["widget.intercom.io", "js.intercomcdn.com"] },
  { id: "pinterest_tag", vendor: "Pinterest Tag", names: ["pinterest"], patterns: ["s.pinimg.com/ct", "pintrk("] },
  { id: "snap_pixel", vendor: "Snap Pixel", names: ["snapchat", "snap inc"], patterns: ["sc-static.net/scevent"] },
];

export const CMPS = [
  { vendor: "OneTrust", patterns: ["cdn.cookielaw.org", "onetrust"] },
  { vendor: "Cookiebot", patterns: ["consent.cookiebot.com", "cookiebot"] },
  { vendor: "Didomi", patterns: ["sdk.privacy-center.org", "didomi"] },
  { vendor: "Usercentrics", patterns: ["usercentrics"] },
  { vendor: "Osano", patterns: ["cmp.osano.com"] },
  { vendor: "CookieYes", patterns: ["cookieyes"] },
  { vendor: "Termly", patterns: ["termly.io"] },
  { vendor: "Google Consent Mode", patterns: ["gtag('consent'", "gtag(\"consent\"", "consent', 'default'"] },
];

export const norm = (s) => (s || "").replace(/\s+/g, " ").trim().toLowerCase();

export function htmlToText(html) {
  return (html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&#39;|&rsquo;/g, "'").replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

// Short raw snippet around a match, used as citable evidence.
function snippet(html, idx, len) {
  return html.slice(Math.max(0, idx - 60), Math.min(html.length, idx + len + 60)).replace(/\s+/g, " ");
}

export function detect(html, policyText) {
  const lower = html.toLowerCase();
  const policy = " " + norm(policyText) + " ";
  const cmp = CMPS.filter((c) => c.patterns.some((p) => lower.includes(p.toLowerCase()))).map((c) => c.vendor);
  const trackers = [];
  for (const t of TRACKERS) {
    const p = t.patterns.find((p) => lower.includes(p.toLowerCase()));
    if (!p) continue;
    const idx = lower.indexOf(p.toLowerCase());
    // Script blocked until consent if its tag is type="text/plain" or carries a consent category attribute.
    const tagStart = lower.lastIndexOf("<script", idx);
    const tag = tagStart >= 0 ? lower.slice(tagStart, lower.indexOf(">", tagStart) + 1) : "";
    const gated = /type=["']?text\/plain/.test(tag) || /data-(cookieconsent|cookiecategory|category|consent)/.test(tag) || /optanon-category/.test(tag);
    const disclosedBy = t.names.find((n) => policy.includes(n)) || null;
    trackers.push({ id: t.id, vendor: t.vendor, matched: p, evidence: snippet(html, idx, p.length), gatedByConsent: gated, disclosedInPolicy: !!disclosedBy, disclosedTerm: disclosedBy });
  }
  const hosts = [...new Set([...html.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)].map((m) => { try { return new URL(m[1], "https://x.invalid").host; } catch { return null; } }).filter((h) => h && h !== "x.invalid"))];
  return { cmp, trackers, scriptHosts: hosts };
}

export function findPolicyUrl(html, base) {
  const links = [...html.matchAll(/<a[^>]+href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)];
  // Prefer an explicit "privacy policy/notice" link over any URL that merely contains "privacy".
  const hit = links.find(([, href, text]) => /privacy[\s-]*(policy|notice|statement)/i.test(text) || /privacy[-_]?(policy|notice|statement)/i.test(href))
    || links.find(([, , text]) => /privacy/i.test(text)) || links.find(([href]) => /privacy/i.test(href));
  try { return new URL(hit ? hit[1] : "/privacy", base).toString(); } catch { return null; }
}

// Verification loop: every model claim must be backed by evidence we can find ourselves.
export function verify(findings, scan, html, policyText) {
  const rawHtml = norm(html);
  const policy = norm(policyText);
  return (findings || []).map((f) => {
    const reasons = [];
    const t = scan.trackers.find((x) => x.id === f.tracker_id);
    if (!t) reasons.push("tracker not present in page source");
    if (!policy && f.issue !== "pre_consent") reasons.push("privacy policy text was not fetched, so disclosure cannot be checked");
    if (f.issue === "undisclosed" && t && t.disclosedInPolicy) reasons.push(`policy does mention "${t.disclosedTerm}"`);
    if (f.issue === "pre_consent" && t && t.gatedByConsent) reasons.push("script tag is consent-gated");
    if (f.policy_quote && !policy.includes(norm(f.policy_quote).slice(0, 80))) reasons.push("policy quote not found in policy text");
    if (t && !rawHtml.includes(norm(t.matched))) reasons.push("evidence not found in HTML");
    return { ...f, vendor: t?.vendor || f.tracker_id, evidence: t?.evidence || null, verified: reasons.length === 0, rejected_because: reasons };
  });
}
