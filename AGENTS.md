# AGENTS.md

## 1. Purpose

This repository contains the frontend implementation for a Chrome Extension based URL analysis service.

All AI coding agents, code generation tools, and contributors MUST follow the project UI specification and design system before creating or modifying any user-facing interface.

The primary reference documents are:

- `DESIGN.md`
- `UI_SPEC.md`

These documents define the visual system, screen structure, user flow, state handling, and interaction rules.

---

# 2. Source of Truth

Use the following priority order for UI implementation decisions.

## Priority 1 — `DESIGN.md`

`DESIGN.md` is the primary source of truth for visual styling.

It governs:

- colors
- typography
- font families
- spacing
- sizing
- border radius
- borders
- shadows
- button appearance
- input appearance
- icon style
- visual hierarchy
- surface styling
- component visual language

Do NOT replace values defined in `DESIGN.md` with arbitrary alternatives.

---

## Priority 2 — `UI_SPEC.md`

`UI_SPEC.md` is the primary source of truth for product UX and screen behavior.

It governs:

- screen composition
- Chrome Extension Popup structure
- detailed analysis page structure
- user flow
- loading states
- error states
- result states
- URL input behavior
- analysis state transitions
- button behavior
- accordion behavior
- result presentation
- L2 / L3 / L4 evidence layout
- responsive behavior
- accessibility behavior
- terminology
- copy tone

Do NOT modify these flows merely for implementation convenience.

---

## Priority 3 — Existing Codebase

Reuse existing components, utilities, state management patterns, API clients, and project conventions when they do not conflict with `DESIGN.md` or `UI_SPEC.md`.

---

## Priority 4 — Implementation Choice

Only make independent implementation decisions when the behavior or visual rule is not defined in:

1. `DESIGN.md`
2. `UI_SPEC.md`
3. existing reusable project code

When doing so, prefer the simplest implementation that remains consistent with the existing product.

---

# 3. Required Pre-Implementation Workflow

Before creating or modifying any user-facing UI:

1. Read `DESIGN.md`.
2. Read the relevant section of `UI_SPEC.md`.
3. Inspect existing reusable components.
4. Inspect existing design tokens / CSS variables / theme definitions.
5. Determine the UI state being implemented.
6. Implement without changing the specified user flow.

Do NOT begin a UI implementation from the prompt alone when the referenced documents are available.

---

# 4. Product Scope

The initial product consists of two primary surfaces.

## 4.1 Chrome Extension Popup

Responsibilities:

- automatically populate the current tab URL
- allow manual URL editing
- validate URL input
- start fast analysis
- display fast analysis progress
- display fast analysis results
- offer deep analysis
- recover an in-progress or completed fast analysis after popup reopen

The popup is a narrow, single-column interface.

Target width:

```text
approximately 340px
```

The popup MUST remain concise.

---

## 4.2 Detailed Analysis Page

Route:

```text
/analysis/{job_id}
```

Responsibilities:

- restore the analysis state using `job_id`
- display deep-analysis progress
- allow cancellation
- handle temporary connection loss
- display final analysis results
- display L2 / L3 / L4 evidence
- preserve the completed analysis result for the same job

The page is desktop-first with basic responsive behavior.

Recommended content width:

```text
max-width: 960px
```

---

# 5. Design Direction

The UI should feel:

- light
- minimal
- calm
- modern
- information-first
- based on the active Inter-based design specification rather than a traditional security dashboard

Avoid:

- excessive dark surfaces
- red-heavy layouts
- cyberpunk styling
- glowing borders
- excessive cards
- oversized warning graphics
- decorative security imagery
- unnecessary animation
- dense enterprise dashboard styling

Security status should be visible without dominating the entire interface.

---

# 6. Typography

Use the font defined in `DESIGN.md` as the primary UI font.

Fallback order:

1. `DESIGN.md` font
2. appropriate fallback for that font
3. system font

Technical values MAY use a monospace font.

Examples:

- URL
- domain
- IP address
- hash
- certificate fingerprint
- technical identifiers

Do NOT replace the `DESIGN.md` font with a system font merely for convenience.

---

# 7. Color Rules

Base colors MUST follow `DESIGN.md`.

Semantic security states:

- Safe → green safe token from the current `DESIGN.md`
- Caution → amber / yellow family
- Dangerous → red family

Exact colors should be mapped to the closest appropriate design tokens from `DESIGN.md`.

Use state color primarily for:

- status icon
- status label
- accent
- subtle background tint where appropriate

Do NOT fill large page areas with strong semantic colors.

Do NOT rely on color alone to communicate state.

Always combine:

```text
icon + text + semantic color
```

---

# 8. Component Styling Rules

Prefer reusable components.

Typical reusable components may include:

```text
Button
TextInput
StatusBadge
StatusIcon
ResultCard
EvidenceList
EvidenceItem
Accordion
InlineNotice
CopyButton
LoadingIndicator
TechnicalValue
```

If a suitable component already exists, reuse or extend it instead of creating a visually similar duplicate.

---

# 9. Card Usage

Place most explanatory text inside quiet bordered surfaces so users can scan each content group clearly.

Use cards primarily for:

- analysis metadata
- final verdict
- key evidence
- L2 / L3 / L4 category containers
- the result disclaimer

Keep these structural elements outside cards:

- page header
- page footer
- progress states
- page and major section headings such as `분석 결과`, `핵심 근거`, and `상세 분석`

Use the same white surface, 1px border, and 8px radius for supporting boxes. Do not add shadows or strong fills merely because more content is boxed.

Per the latest user request, render every L2/L3/L4 category and individual detailed evidence item as a full-width white bordered box, including categories with zero findings. Remove content indentation in L2/L3/L4 sections and align expanded descriptions and technical values to one left edge inside each evidence box.

---

# 10. Chrome Extension Popup Rules

## 10.1 Header

Use:

```text
small logo + service name
```

Do not create a large hero header.

Do not display favicon information for the target website.

---

## 10.2 URL Input

Label:

```text
분석할 URL
```

Default:

- automatically fill the active tab URL when supported
- allow the user to replace it

Supported protocols:

```text
http://
https://
```

Unsupported examples:

```text
chrome://
chrome-extension://
file://
about:
```

When the current tab is unsupported:

- leave the input empty
- disable `분석 시작`
- enable the button when the user enters a valid HTTP/HTTPS URL

---

## 10.3 URL Normalization

If protocol is omitted:

```text
example.com
```

normalize to:

```text
https://example.com
```

Preserve explicitly provided:

```text
http://
```

Preserve:

- path
- query string
- fragment

Show the normalized URL back to the user before / during analysis.

---

## 10.4 Validation

During typing:

- determine validity
- enable or disable the submit button

Do NOT continuously show aggressive validation errors while the user is typing.

Show a visible error when:

- input is clearly invalid
- the user attempts to submit invalid input

---

# 11. Fast Analysis

Primary CTA:

```text
분석 시작
```

After analysis starts:

- disable URL input
- disable the start button
- prevent a second fast-analysis job
- preserve the current analysis target

Only one fast-analysis job may run at a time.

---

# 12. Fast Analysis Progress

Use only a small loading indicator and the same scanning label as deep analysis.

Example:

```text
스캔 중...
```

Do NOT show percentage progress, stage lists, or per-stage complete / active / pending states.

---

# 13. Popup State Restoration

Fast analysis MUST continue if the popup closes.

When reopened:

- if the job is running → restore the `스캔 중...` loading state
- if the job completed → restore the result state

Do NOT restart the analysis simply because the popup UI was closed.

---

# 14. Active Tab URL Synchronization

When no analysis is active:

- update the URL input when the active tab URL changes

While analysis is running:

- preserve the analyzed URL

While viewing a result:

- preserve the analyzed URL

After the user selects `종료`:

- clear the result state
- return to the initial state
- refresh the input with the current active tab URL

---

# 15. Fast Analysis Verdict

User-facing verdict values are limited to:

```text
안전
주의
위험
```

Do NOT expose:

- numeric risk score
- confidence percentage
- internal thresholds

Internal values may still exist for ranking and decision logic.

---

# 16. Fast Analysis Result Layout

Use this order:

```text
Verdict
Short explanation
Key evidence
Deep-analysis prompt
Actions
```

Example:

```text
주의

주의가 필요한 신호가 확인되었습니다.

핵심 근거
• 비정상 페이지 이동
• 외부 도메인 로그인 전송
• 인증서 이상

더 자세한 분석을 진행할까요?

[ 종료 ] [ 심층 분석 ]
```

---

# 17. Fast Analysis Explanation

Do NOT use an LLM for the popup summary.

Generate the short explanation using deterministic templates.

For the `주의` verdict, use only the concise generic message `주의가 필요한 신호가 확인되었습니다.` Do not repeat individual detections in the summary; the key-evidence list provides those details.

Inputs may include:

- verdict
- top evidence types

The wording must remain concise and consistent.

---

# 18. Key Evidence Ranking

For the popup, display at most:

```text
3 items
```

Sort by:

1. severity
2. confidence
3. detection order

`confidence` is for internal ranking only.

Do NOT expose confidence values to the user.

---

# 19. Fast Analysis Actions

## `종료`

Role:

```text
Secondary
```

Behavior:

- clear current result
- keep popup open
- return to the initial input state
- reload current active tab URL

## `심층 분석`

Role:

```text
Primary
```

Behavior:

- create / use deep-analysis job
- open a new tab
- navigate to `/analysis/{job_id}`
- popup closes naturally after losing focus

Always make deep analysis available regardless of the fast verdict.

---

# 20. Partial Fast-Analysis Failure

A partial collector or analysis failure MUST NOT automatically fail the whole job.

If enough data exists to produce a useful result:

- return the result
- show a small inline notice

Example:

```text
일부 콘텐츠 분석을 완료하지 못했습니다.
```

Only return a full failure if the analysis cannot produce a meaningful result.

---

# 21. Fast-Analysis Failure

Handle inside the popup.

Do not navigate to a separate error page.

Example:

```text
분석을 완료하지 못했습니다.
잠시 후 다시 시도해주세요.

[다시 시도]
```

---

# 22. Deep Analysis Route

Use:

```text
/analysis/{job_id}
```

Do not expose the analyzed URL as a route parameter.

The route must be restorable via `job_id`.

---

# 23. Deep Analysis Loading State

Do NOT show detailed agent steps.

Use only a simple loading state.

Example:

```text
스캔 중...

페이지를 닫거나 새로고침해도
분석 상태는 유지됩니다.

[분석 취소]
```

Do NOT show:

- percentage
- L4 internal reasoning
- browser actions
- agent action list
- intermediate evidence stream

---

# 24. Deep Analysis Cancellation

Provide:

```text
분석 취소
```

On cancellation:

- mark job as cancelled
- stop deep-analysis execution when supported
- render cancelled state

Cancelled state:

```text
분석이 취소되었습니다.

요청한 심층 분석이 중단되었습니다.

[닫기]
```

Do NOT provide `다시 분석` on this page.

---

# 25. Temporary Connection Failure

Temporary network or backend-status retrieval failures must not immediately become analysis failures.

Show:

```text
연결을 다시 확인하는 중입니다...
```

Retry automatically.

If the connection recovers:

- return to loading state
- or display completed result

After repeated failures, show:

```text
상태를 불러오지 못했습니다.

[다시 시도]
```

This is a status-fetch failure, not necessarily an analysis failure.

---

# 26. Deep Analysis Failure

If the deep-analysis job itself fails:

```text
심층 분석을 완료하지 못했습니다.

분석 과정에서 오류가 발생했습니다.
잠시 후 다시 시도해주세요.

[닫기]
```

Do NOT provide a rerun action on the detailed analysis page.

---

# 27. Deep Analysis Completion

When the job completes:

1. show a very brief completion state
2. automatically transition to final result
3. move viewport to the final-verdict area

The user must not need to manually refresh.

---

# 28. Final Result Page

Use one long page with sections.

Do NOT use tab navigation for L2/L3/L4.

Order:

```text
Header
Analysis metadata
Final verdict
Initial analysis result
Key evidence
L2 Network Analysis
L3 Content Analysis
L4 Cloaking / Behavior Analysis
```

---

# 29. Header

Use a minimal header:

```text
small logo + service name
```

Do not add:

- unrelated navigation
- account menu unless required by future scope
- extra product links

---

# 30. Analysis Metadata

Display:

- analyzed URL
- analysis completed time

Example:

```text
example.com
분석 완료 · 2026.09.08 13:42
```

The analyzed URL must NOT be clickable.

---

# 31. Final Verdict

Deep-analysis verdict is the primary result.

The fast-analysis verdict should be labeled as:

```text
초기 분석 결과
```

The deep-analysis verdict should be labeled as:

```text
최종 판정
```

If the verdict changed, explicitly show the transition.

Example:

```text
초기 분석  주의
      ↓
최종 판정  위험
```

If unchanged, do not emphasize the transition.

---

# 32. Final Verdict Logic vs LLM

The LLM MUST NOT determine the final verdict.

The verdict must come from deterministic project analysis logic / rule logic.

LLM responsibility is limited to:

```text
L2 + L3 + L4 evidence
→ concise user-facing summary
```

Target:

```text
1–2 sentences
```

If the LLM summary fails:

- still show final verdict
- still show evidence
- use a deterministic fallback message

Example:

```text
위험 신호가 여러 개 확인되었습니다.
아래 상세 근거를 확인해주세요.
```

LLM failure must not invalidate the analysis job.

---

# 33. Detailed Evidence Copy

Individual evidence descriptions must NOT be generated freely by an LLM.

Use deterministic templates.

Each evidence item should generally contain:

```text
User-friendly title
Technical label
1–2 line explanation
```

Example:

```text
외부 도메인으로 로그인 정보 전송
Form Action Domain

로그인 폼의 전송 대상이 현재 사이트와 다른 도메인으로 확인되었습니다.
```

---

# 34. Detailed Key Evidence

Display at most:

```text
5 key evidence items
```

Keep the key-evidence section expanded.

Key evidence may repeat evidence shown later in the L2/L3/L4 sections.

This is intentional:

```text
Key evidence = summary
Detailed section = validation / detail
```

---

# 35. Key Evidence Navigation

Key evidence items should be interactive.

On selection:

1. determine related L2/L3/L4 section
2. open that accordion
3. scroll to the specific evidence item

Do not navigate to another page.

---

# 36. L2 / L3 / L4 Sections

Use the following user-facing labels:

```text
네트워크 분석
콘텐츠 분석
클로킹 / 행동 분석
```

Technical labels may additionally indicate:

```text
L2
L3
L4
```

Use accordion sections.

---

# 37. Evidence Count Badge

Each L2/L3/L4 section should display the number of meaningful findings.

Example:

```text
네트워크 분석        3
콘텐츠 분석          2
클로킹 / 행동 분석   1
```

Use a small count badge.

Avoid alarmist copy such as:

```text
3건 탐지!
```

---

# 38. Zero-Evidence Sections

Do NOT hide an analysis section just because it has no findings.

Keep the section visible.

When expanded:

```text
특이사항이 확인되지 않았습니다.
```

This communicates that the analysis category was actually checked.

---

# 39. Default Accordion State

L2/L3/L4 sections are normally collapsed.

Automatically open only the section with the highest meaningful-evidence count.

If tied:

```text
L4 → L3 → L2
```

---

# 40. Evidence List Layout

Use a vertical list.

Prefer:

```text
Title
Technical label
Description
Optional details
```

Avoid dense table layouts for primary evidence presentation.

---

# 41. Normal / Negative Findings

Do not list every non-detected signal.

Avoid large lists such as:

```text
HTTP Refresh 없음
IP Redirect 없음
Forced Download 없음
Content-Type mismatch 없음
...
```

Show primarily:

- detected evidence
- meaningful supporting evidence
- information necessary to understand the verdict

A compact category-level summary MAY be shown where useful.

Example:

```text
검사된 항목 8개 · 이상 2개
```

---

# 42. Raw Data Details

Evidence descriptions and raw values should be hidden by default.

Do not provide a separate `상세 보기` control. Make the evidence-item header itself the expandable control, and reveal the description and raw values together.

Expanded values should use a clean Key-Value layout.

Do NOT dump raw JSON into the primary user interface.

---

# 43. Technical Values

Use Key-Value formatting.

Example:

```text
Target URL
https://login-example.net/auth

Current Domain
example.com
```

Use monospace selectively for technical values.

Long values should:

- truncate initially
- support `전체 보기`

---

# 44. Dangerous URL Interaction

Analyzed URLs, domains, and redirect targets MUST NOT be clickable hyperlinks.

Reason:

- prevent accidental navigation to potentially malicious destinations

Display as plain text.

A copy action may be provided.

---

# 45. Copy Interaction

Technical values may provide a small copy icon/button.

After copying:

- do not use a disruptive modal
- do not require confirmation
- show short inline feedback

Example:

```text
복사됨
```

---

# 46. Motion

Prioritize functional motion, while allowing restrained entrance effects that clarify visual hierarchy.

Timing:

- general UI transitions: `120ms–200ms ease-out`
- individual evidence accordion transitions: at most `220ms ease-out`
- L2 / L3 / L4 layer accordion transitions: `300ms` with restrained easing
- after an accordion expands, adjust the viewport only when its content falls outside the visible area; use the minimum scroll distance and align oversized content from its heading
- result and section entrances: `180ms–240ms ease-out`
- loading spinner: `1s linear infinite`
- scanning icon and label pulse: `1.8s ease-in-out infinite`

When fast analysis changes from scanning to completed, animate the result container once from `opacity: 0` and `translateY(4px)` to `opacity: 1` and `translateY(0)`. Announce the completed state to assistive technology immediately; do not wait for the animation to finish.

Allowed:

- loading indicator
- low-contrast pulse on the fast-analysis loading icon and label
- accordion transition; closing an L2 / L3 / L4 layer also resets its expanded evidence items
- button hover / press
- fast-analysis result fade-in with a 4px upward entrance
- short detailed-result fade-in
- result cards and sections entering by no more than 8px
- a one-time verdict-icon scale transition of no more than 3%
- sequential entrance of the popup result blocks and detailed-result major blocks in DOM order with `50ms` between blocks; each block uses a `220ms ease-out` entrance
- a low-contrast pulse confined to a loading indicator
- copy-state transition

Do not add continuous animation unrelated to an active state, movement over 12px, scale changes over 3%, glow or full-background flashing, or transitions that block interaction or delay critical content. Keep decorative motion subtle and one-time.

Under `prefers-reduced-motion: reduce`, remove movement and spinner rotation and show the result immediately. Preserve status announcements and visible keyboard focus.

---

# 47. Responsive Behavior

Detailed analysis page is desktop-first.

Maintain:

```text
max-width: 960px
```

On smaller screens:

- reduce horizontal padding
- keep single-column structure
- allow cards and accordions to fill available width
- wrap or truncate long values safely
- allow buttons to become wider where necessary

Do not create a separate mobile information architecture for the initial release.

---

# 48. Accessibility

UI implementation must include basic accessibility support.

Required:

- do not use color as the sole state indicator
- visible keyboard focus
- keyboard-operable buttons
- keyboard-operable accordions
- keyboard-operable copy controls
- sufficient contrast
- meaningful labels
- loading / completion / error state announcements for assistive technology

Use semantic HTML where possible.

---

# 49. Copy Tone

The product copy must remain:

- neutral
- evidence-based
- concise
- explanatory
- non-alarmist

Prefer:

```text
위험 신호가 확인되었습니다.
의심스러운 동작이 발견되었습니다.
악성 가능성이 높은 신호가 확인되었습니다.
```

Avoid unsupported certainty:

```text
이 사이트는 반드시 악성입니다.
당신의 정보가 탈취됩니다.
```

Avoid unnecessary imperative warnings unless product policy later explicitly requires them.

---

# 50. Initial Release Exclusions

Do NOT implement the following unless specifically requested in a later specification.

- dark mode
- result sharing
- PDF export
- JSON export
- report download
- final-result rerun button
- multiple simultaneous fast-analysis jobs
- numeric risk score UI
- confidence UI
- clickable analyzed URLs
- deep-analysis percentage progress
- detailed L4 execution-step UI
- exhaustive lists of all negative findings
- separate mobile-specific UX
- favicon display in popup

---

# 51. State Modeling

UI state should be explicit rather than inferred from unrelated booleans.

Recommended conceptual states for the popup:

```text
idle
validating
scanning
partial_result
result
error
```

Recommended conceptual states for detailed analysis:

```text
loading_job
scanning
reconnecting
completed
cancelled
failed
status_fetch_error
```

Exact implementation may differ according to the existing project architecture, but avoid contradictory state combinations.

---

# 52. Data / UI Separation

Do not couple raw backend response structures directly to rendered UI.

Prefer a presentation mapping layer.

Example conceptual flow:

```text
API response
    ↓
normalize / map
    ↓
UI view model
    ↓
component rendering
```

This allows backend evidence fields to remain technical while UI text stays user-friendly and stable.

---

# 53. Evidence Presentation Model

A normalized evidence item should conceptually support fields such as:

```text
id
layer
severity
confidence
user_title
technical_label
description
raw_values
priority
```

The exact schema may follow the backend contract, but UI code should not derive user-facing strings ad hoc inside component markup.

---

# 54. No Arbitrary Visual Values

Do not introduce arbitrary values such as:

```text
#ff0000
17px
13px
9px radius
custom shadow copied from another site
```

when an appropriate token exists in `DESIGN.md` or the project theme.

Prefer design tokens / CSS variables / theme values.

---

# 55. No Unrequested Product Expansion

Do not add features just because they appear useful.

Examples:

- history page
- dashboard navigation
- scan history
- user profile
- share button
- export button
- re-analysis
- threat intelligence tabs
- charts
- score gauges

Implement only the scope described by the current specification.

---

# 56. Implementation Review Checklist

Before considering a UI task complete, verify:

- [ ] `DESIGN.md` was followed
- [ ] `UI_SPEC.md` behavior was followed
- [ ] no unsupported product feature was added
- [ ] popup remains single-column and concise
- [ ] fast analysis does not expose percentage progress
- [ ] deep analysis does not expose internal agent steps
- [ ] final verdict is not generated by LLM
- [ ] user-facing detailed evidence uses templates
- [ ] URLs are not clickable
- [ ] technical values can be safely truncated
- [ ] semantic states include text and icons
- [ ] accessibility basics are implemented
- [ ] responsive layout does not break
- [ ] reusable components were preferred
- [ ] arbitrary design values were avoided

---

# 57. Relationship Between Project Documents

```text
DESIGN.md
    │
    └─ Visual appearance
       ├─ Typography
       ├─ Color
       ├─ Spacing
       ├─ Radius
       └─ Component styling

UI_SPEC.md
    │
    └─ Product behavior
       ├─ Screen structure
       ├─ User flow
       ├─ State transitions
       ├─ Evidence presentation
       └─ Error / loading behavior

AGENTS.md
    │
    └─ Implementation constraints
       ├─ Read both documents first
       ├─ Preserve their priority
       ├─ Reuse components
       └─ Avoid scope expansion
```

---

# 58. Final Rule

When a requested implementation conflicts with an existing documented rule:

1. do not silently override the specification
2. identify the conflict
3. preserve the documented behavior unless the specification is explicitly changed

The UI should be implemented as a coherent product, not redesigned independently on a page-by-page basis.
