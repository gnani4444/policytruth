---
version: 1
slug: "app-page-js"
primary_target: "app/page.js"
related_targets: []
---

# Surface: PolicyTruth app (app/page.js)

Mode: Operate (single-page audit tool), with a first viewport that must also persuade judges in a demo.
Audience: UK founders / DPOs and hackathon judges, equal weight. Job: enter a domain, get a verified verdict, approve findings, get fixes.
Constraints: white background (pinned); every feature survives; tabs may nest (exports, agent trace, history inside other views); not generic SaaS, not bureaucratic.
Motion sources: React Bits (BlurText, CountUp, DecryptedText), 21st.dev / motion-primitives (AnimatedBackground, TextShimmer).

## Direction contract
THESIS: Every audit is a roadworthiness test for a website: a test certificate with a verdict and numbered defects, refusing the KPI-card SaaS dashboard.
OWN-WORLD: White sheet, ink #0b0c0c, rear-plate yellow #ffd400 reserved for the domain plate, pass green #00703c, fail red #d4351c; ruled defect lines numbered by category; Archivo at expanded widths for plate and verdict, JetBrains Mono only for evidence.
STORY: Visitor types a domain into a number plate, watches the inspection lane tick, reads PASS or FAIL with Dangerous/Major/Minor defects and verifier rejections, approves defects, receives fixes.
FIRST VIEWPORT: Left two-thirds: headline at display scale, yellow plate input with black Start test button beside it, agent toggle, examples. Right third: the inspection manual, every real check listed.
FORM: MOT test certificate, position 1 on the ordered list (pick card), seed ba6891e3.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

Signature interaction: verdict stamp lands (blur and scale settle) while the score counts up; the plate decrypts the host.
