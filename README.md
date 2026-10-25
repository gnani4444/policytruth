# PolicyTruth

**Does your website do what your privacy policy says?**

Live: https://policytruth-seven.vercel.app

PolicyTruth loads a website, records which trackers it actually loads, and compares that with the site's own privacy policy.
Gemini finds the mismatches. A deterministic verifier rejects any claim it cannot back with evidence.
A human approves each finding before Gemini drafts a fix. Every audit, approval and fix is stored in MongoDB Atlas as an audit trail.

## Who it is for

A UK startup founder or DPO who copied a privacy policy template, added Meta Pixel, Hotjar and Google Analytics, and never checked whether the two still match.

## Why it matters

- **The law requires it.** Under UK GDPR and PECR, non-essential cookies and trackers need prior consent, and the privacy policy must name who receives the data.
- **Regulators are checking.** The ICO has been reviewing cookie compliance on the UK's most visited sites and has written to companies that load advertising trackers before consent.
- **Policies drift.** Marketing teams add pixels through tag managers every week. Nobody re-reads the policy, so it goes out of date silently.
- **Existing tools stop halfway.** Cookie scanners list cookies but do not read the policy. Policy generators write text but never look at the site. We found only a research prototype (University of Turku) that compares the two.
- **Sellable now.** Every company with a website and a privacy policy is a customer: agencies, DPO-as-a-service firms, and law firms that run compliance audits.

## How it works

1. **Scan** (`lib/scan.js`, deterministic). Fetch the page and find the privacy policy link. Detect 15 tracker vendors and 8 consent managers. Record whether each tracker's script is consent-gated, and whether the policy names the vendor.
2. **Reason** (Gemini, `gemini-4-argon`, `thinkingLevel: high`). Read the full policy text and the scan. Return mismatches: `undisclosed`, `pre_consent`, `vague_disclosure`, each with an exact policy quote.
3. **Verify** (`verify()` in `lib/scan.js`). Reject any finding whose tracker is not in the page source. Reject any finding that the evidence contradicts, for example "undisclosed" when the policy names the vendor. Reject any finding whose policy quote does not appear in the policy. Rejected claims are shown separately, with the reason.
4. **Human approval.** The reviewer ticks the findings to act on. Nothing is generated for unticked findings, and nothing is changed on the live site.
5. **Fix** (Gemini). For approved findings only: consent-gated script snippets (or Google Consent Mode defaults) and a privacy policy addition.
6. **Store** (MongoDB Atlas, database `policytruth`, collection `audits`). Each audit document holds the scan, findings, verifier verdicts, approvals and drafted fixes. The page shows recent audit history.

## Models and agents used

- `gemini-4-argon` via `@google/genai` `models.generateContent`, JSON output, `thinkingConfig.thinkingLevel: "high"`. Model is configurable with `GEMINI_MODEL`.
- Two Gemini steps: an analysis step (policy + scan, long context) and a fix-drafting step that runs only after human approval.
- Verification loop: deterministic evidence check on every model claim (`lib/scan.test.js`).

## Run locally

```bash
cd policytruth
npm install
cp .env.example .env.local   # fill GEMINI_API_KEY and MONGODB_URI
npm run dev                  # http://localhost:3000
npm test                     # scanner + verifier tests
```

## Deploy

```bash
vercel env add GEMINI_API_KEY production
vercel env add MONGODB_URI production
vercel deploy --prod
```

## Limits (honest)

- Static HTML only: trackers injected later by a tag manager at runtime are not seen. Next step is a headless browser with a network log, before and after consent.
- Vendor detection uses a fixed signature list of 15 vendors.
- Drafts are suggestions for a human to review. This is not legal advice.
