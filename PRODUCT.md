# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
General web users, non-specialists, who meet a link they are unsure about and need to decide whether to open it. In the Chrome popup they want a verdict quickly. On the detailed analysis page they read the evidence behind that verdict. A security-analyst audience is not a confirmed target.

## Product Purpose
LinkGuard is a Chrome extension plus a detailed analysis page that tells a user whether a URL looks safe, needs caution, or is dangerous. It exists so a non-expert can judge a suspicious link and see why. Success is a clear verdict the user understands and can check against the evidence.

## Positioning
Evidence-based, three-stage analysis. A fast analysis in the popup gives a verdict, then an optional deep analysis opens `/analysis/{job_id}`. The deep analysis shows human-verifiable evidence by layer: L2 network, L3 content, and L4 cloaking/behavior. The verdict is deterministic. An LLM only writes the explanatory summary and never decides the verdict (UI_SPEC.md). The differentiator is showing why, not just a score.

## Operating Context
- Chrome extension popup, about 340px wide, single column, at most 540px tall, populated from the active tab URL.
- Detailed analysis page at `/analysis/{job_id}` (web) or `index.html#/analysis/{job_id}` (extension), desktop-first with a 960px content column.
- Deployed as a Vite static site on Vercel. The extension builds separately to `dist-extension`.
- Analysis is asynchronous. The popup can be closed and reopened and the state is recovered. The deep-analysis page handles cancellation and temporary connection loss.

## Capabilities and Constraints
- Currently an API-less mockup. It sends no real requests and performs no security checks. Verdicts and evidence are scenario examples. The backend is undecided, and the `AnalysisService` / `mock-service.ts` boundary is where a real API attaches.
- The UI is Korean only. No localization is planned.
- Only three verdicts are shown to the user: 안전 (safe), 주의 (caution), 위험 (danger). Scores, confidence values, gauges, and charts are not shown.
- One fast analysis runs at a time. The fast-analysis loading state is the single text `스캔 중...` with no step lists or percentages.
- Analysis URLs are not placed in the page address. Only `job_id` is.
- Terms: 고속 분석 (fast analysis), 심층 분석 (deep analysis), 핵심 근거 (key evidence), 원시값 (raw value).
- Flow and behavior live in `UI_SPEC.md`. Visual rules live in `DESIGN.md`. Both are the working authority for this repo (see `AGENTS.md`).
- Dark mode is not supported at this stage (UI_SPEC.md).

## Brand Commitments
- The service name `LinkGuard` is used in the README, but it was not confirmed as binding in this interview. Treat it as the working name.
- No logo asset is on record.

## Evidence on Hand
- No real analysis data, testimonials, customer names, benchmarks, or detection-accuracy claims exist. Do not fabricate them.
- Mock scenarios in `src/data/results.ts` and `src/data/report.ts` cover safe, caution, danger, partial failure, cancellation, connection retry, and failure.
- `docs/design/popup-reference.html` is an older reference and does not override the current `DESIGN.md`.

## Product Principles
- Show the verdict first, then the evidence a person can verify. Never present raw technical data ahead of a plain explanation.
- Security status is visible but calm. Say what was found and why, without alarmist framing.
- Never convey status by color alone. Always pair icon, text, and color.
- Do not overstate certainty. Verdicts come from deterministic rules. Explanations do not decide them.
- Keep the popup short. Depth belongs to the opt-in deep analysis.

## Accessibility & Inclusion
Keyboard operation for accordions and copy actions, visible focus, screen-reader announcements for loading, completion, and error states, and reduced-motion support. Body text is at least 14px in the detail page. Touch targets are at least 44px on mobile. All of this is already required in `DESIGN.md` §20 and `UI_SPEC.md`.
