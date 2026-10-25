# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
- UK startup founders and data protection officers who need to know, today, whether their website and their privacy policy match.
- Hackathon judges (Encode London 2026: Google DeepMind, MongoDB, Agents That Ship) watching a live demo or a recorded video. Equal weight to real users.

## Product Purpose
PolicyTruth audits a website against its own privacy policy. A deterministic scanner records which trackers the site loads. Gemini compares that evidence with the full policy text. A verifier rejects every claim it cannot prove. A human approves each finding before any fix is drafted. Every audit is stored in MongoDB Atlas as an audit trail. Success: a user enters a domain and, within a minute, sees verified gaps with evidence and can draft fixes.

## Positioning
Cookie scanners list cookies but never read the policy; policy generators write text but never look at the site. PolicyTruth does both and then refuses to report anything its verifier cannot prove from evidence.

## Operating Context
- Single-page Next.js app (`app/page.js`) calling `/api/audit` (POST audit or fix, GET history).
- Two audit modes: quick pipeline, and agent mode (Gemini tool-calling, crawls up to 6 same-site pages, revises after verifier feedback). Audits take 25 to 90 seconds.
- Results views: overview (score, grade, KPIs, pipeline steps), agent trace, verified and rejected findings with approval, trackers inventory, policy checks (UK GDPR Article 13, readability, age, privacy headers), drafted fixes, history, how it works.
- Exports: Markdown report, raw JSON, print/PDF.
- Regulatory frame: UK GDPR and PECR.

## Capabilities and Constraints
- Every existing feature must survive the redesign. Tabs may be regrouped and nested (exports, agent trace, history can live inside other views).
- Deployed on Vercel; stack is Next.js 15, React 19. Tailwind v4 and motion approved for the redesign so React Bits and 21st.dev components can be used.
- Not legal advice; output is drafted suggestions for human review.

## Brand Commitments
- Name: PolicyTruth. Tagline: "Does your website do what your privacy policy says?"
- White background (user-pinned for the redesign).
- Must not read as a generic SaaS template, and must not read as legal or bureaucratic.

## Evidence on Hand
- Live deployment: https://policytruth-seven.vercel.app
- Real audit output from live sites (theguardian.com, asos.com, bbc.co.uk, monzo.com are the suggested examples).
- Architecture diagram: `docs/architecture.html`, `docs/architecture.png`.
- No customers, testimonials, or benchmarks exist; do not invent them.

## Product Principles
1. Evidence before claims: every finding shows its page-source and policy proof.
2. The verifier is the product: rejected claims are shown, not hidden.
3. A human approves before anything is drafted.
4. Fast to first answer: a domain in, a verdict out.
