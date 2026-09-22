# DESIGN.md

## 1. Purpose

본 문서는 Chrome Extension 기반 악성 URL 분석 서비스의 **시각 디자인 시스템**을 정의한다.

적용 대상:

- Chrome Extension Popup
- 상세 분석 페이지 `/analysis/{job_id}`

화면 구조와 UX 흐름은 `UI_SPEC.md`를 따르며, 본 문서는 **색상, 폰트, 크기, 굵기, 간격, radius, border, 상태 표현, 컴포넌트 스타일**의 기준으로 사용한다.

---

## 2. Design Direction

전체 디자인은 다음 조합을 기준으로 한다.

- **Vercel**: 절제된 흑백 구조, hairline border, 기술 도구 느낌
- **Linear**: 조밀하지만 명확한 정보 위계와 인터랙션
- **Notion**: 읽기 편한 여백과 긴 문서형 결과 페이지 구조

목표 인상:

- light
- minimal
- calm
- modern
- information-first
- developer-tool oriented
- security status is visible but not dominant

피해야 할 방향:

- 전통적인 SOC / SIEM 대시보드 스타일
- 과도한 빨간색 배경
- cyberpunk / glow / neon
- 카드 남발
- 지나치게 작은 글씨
- 지나치게 흐린 회색 텍스트
- 모든 기술 라벨에 monospace 사용
- 숫자형 위험도 게이지

---

## 3. Color Tokens

```css
:root {
  --color-canvas: #fafafa;
  --color-surface: #ffffff;
  --color-surface-subtle: #f7f7f8;
  --color-surface-hover: #f4f4f5;
  --color-surface-selected: #f0f6ff;

  --color-text: #18181b;
  --color-text-secondary: #3f3f46;
  --color-text-muted: #71717a;
  --color-text-faint: #8b8b95;
  --color-text-disabled: #a1a1aa;

  --color-border: #e4e4e7;
  --color-border-strong: #d4d4d8;

  --color-primary: #18181b;
  --color-primary-hover: #27272a;
  --color-primary-active: #09090b;
  --color-primary-on: #ffffff;

  --color-blue: #2563eb;
  --color-blue-soft: #eff6ff;
  --color-focus: rgba(37, 99, 235, 0.24);

  --color-safe: #15803d;
  --color-safe-soft: #f0fdf4;
  --color-safe-border: #bbf7d0;

  --color-caution: #b45309;
  --color-caution-soft: #fffbeb;
  --color-caution-border: #fde68a;

  --color-danger: #b91c1c;
  --color-danger-soft: #fef2f2;
  --color-danger-border: #fecaca;
}
```

### Color usage rules

- 기본 구조는 흑백/회색 계열을 우선한다.
- Blue는 focus, selected state, 링크가 아닌 구조적 강조에만 제한적으로 사용한다.
- Safe / Caution / Danger 색상은 다음에만 강하게 사용한다.
  - 상태 아이콘
  - 판정 텍스트
  - 작은 accent
  - 아주 옅은 상태 배경
- 큰 면적을 강한 상태색으로 채우지 않는다.
- 색상만으로 상태를 전달하지 않는다. 항상 **아이콘 + 텍스트 + 색상**을 함께 사용한다.

---

## 4. Typography

### 4.1 Font Family

Primary UI font:

```css
font-family:
  Inter,
  Pretendard,
  -apple-system,
  BlinkMacSystemFont,
  "Segoe UI",
  Helvetica,
  Arial,
  sans-serif;
```

Technical value only:

```css
font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
```

Monospace 적용 대상:

- URL
- Domain
- IP
- Hash
- Certificate Fingerprint
- Job ID
- 기타 식별자 값

Monospace 비적용 대상:

- `Form Action Domain`
- `Redirect Chain`
- `Certificate Validity`
- `DOM Event Handler`
- 기타 기술 라벨

기술 라벨은 일반 UI 폰트로 표시한다.

---

### 4.2 Typography Scale

사용자 피드백에 따라 전체 타이포그래피를 한 단계 축소했다. 본문은 14px, 메타 정보는 13px을 유지하며 제목과 판정 크기를 비례 조정한다.

#### Page Title

```text
font-size: 26px
font-weight: 750
line-height: 1.25
letter-spacing: -0.5px
```

#### Section Title

```text
font-size: 18px
font-weight: 700
line-height: 1.35
letter-spacing: -0.2px
```

#### Card / Evidence Title

```text
font-size: 15px
font-weight: 700
line-height: 1.45
```

#### Verdict

상세 페이지:

```text
font-size: 32px
font-weight: 750
line-height: 1.12
letter-spacing: -0.7px
```

Popup:

```text
font-size: 28px
font-weight: 750
line-height: 1.15
letter-spacing: -0.5px
```

#### Body

```text
font-size: 14px
font-weight: 400
line-height: 1.62
```

#### Body Strong

```text
font-size: 14px
font-weight: 600
line-height: 1.55
```

#### Supporting Description

```text
font-size: 14px
font-weight: 400
line-height: 1.65
color: var(--color-text-secondary)
```

#### Metadata

```text
font-size: 13px
font-weight: 500
line-height: 1.5
color: var(--color-text-muted)
```

#### Technical Label

```text
font-size: 12.5px
font-weight: 600
line-height: 1.4
color: var(--color-text-muted)
```

#### Small Label

```text
font-size: 12px
font-weight: 600
line-height: 1.4
```

### Typography rules

- 본문은 14px 미만으로 줄이지 않는다.
- 보조 정보도 가능한 13px 이상을 유지한다.
- 제목/본문/메타 정보 사이의 굵기 차이를 명확히 둔다.
- 긴 설명은 `line-height: 1.6~1.7`을 유지한다.
- muted text는 너무 연하게 만들지 않는다.
- 결과 페이지는 디자인보다 **읽기 흐름**을 우선한다.

---

## 5. Spacing

```css
:root {
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;
  --space-12: 48px;
}
```

### Layout rhythm

- 동일 컴포넌트 내부: `8~16px`
- 판정 카드 내부: `16px`
- 핵심 / 상세 근거 박스 내부: `12px`
- 근거 박스 사이: `8px`
- 관련 섹션 사이: `16px`
- 주요 섹션 사이: `32px`
- 페이지 상단/하단 여백: `32~48px`

사용자 요청에 따라 박스 여백과 항목 사이 간격을 축소한다. 글씨 크기, 본문 줄 간격, 버튼의 조작 영역은 유지한다.

---

## 6. Radius

```css
:root {
  --radius-xs: 4px;
  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
  --radius-pill: 999px;
}
```

사용 기준:

- Input / Button: `8px`
- Evidence item: `8px`
- High-priority card: `12px`
- Badge: pill

과도하게 둥근 SaaS 카드 스타일은 피한다.

---

## 7. Border & Shadow

### Border

기본:

```css
border: 1px solid var(--color-border);
```

강한 구분이 필요한 경우:

```css
border: 1px solid var(--color-border-strong);
```

### Shadow

일반 카드에는 shadow를 사용하지 않는다.

단, 상세 분석 페이지는 §10의 예외 규칙(판정 카드와 콘텐츠 박스의 옅은 shadow)을 따른다.

Floating UI에서만 허용:

```css
box-shadow: 0 8px 30px rgba(0, 0, 0, 0.08);
```

사용 가능:

- Dropdown
- Modal
- Floating popover

사용 금지:

- 일반 Evidence 카드
- L2/L3/L4 섹션
- 최종 판정 카드 기본 상태

---

## 8. Page Layout

### Detailed Analysis Page

```text
max-width: 960px
margin: 0 auto
padding: 40px 32px 64px
```

작은 화면:

```text
padding: 24px 16px 48px
```

페이지는 한 열 구조를 유지한다.

L2 / L3 / L4는 탭이 아니라 **세로 섹션형 아코디언**으로 구성한다.

---

## 9. Chrome Extension Popup

권장 크기:

```text
width: 340px
min-height: 200px
max-height: 540px
```

기본:

```css
background: var(--color-surface);
color: var(--color-text);
```

Popup은 한 열 구조로 유지하며 정보량을 과도하게 늘리지 않는다.

### Outer frame / Inner panel

- 바깥 팝업은 340px 직사각형이며 `--color-surface-subtle` 배경을 사용한다.
- 바깥 프레임과 내부 패널 사이 여백은 `--space-3` (12px), 내부 패널의 콘텐츠 여백은 `--space-4` (16px)로 둔다.
- 팝업 근거 박스 여백은 12px, 판정 아이콘 영역은 32px로 줄인다.
- 헤더부터 결과·액션까지 하나의 흰색 내부 패널로 감싼다.
- 내부 패널은 `--radius-lg` (12px) 곡률과 `--color-border` 1px 테두리를 사용하며 그림자는 추가하지 않는다.
- 바깥 여백을 포함해 최대 높이 540px을 유지하고, 넘치는 콘텐츠는 내부 패널에서 스크롤한다.
- 웹 미리보기와 실제 확장 팝업에 동일한 구조를 적용한다.

### Header

```text
작은 로고 + 서비스명
```

- 큰 hero title 금지
- favicon 금지

### Result typography

340px 팝업에는 아래 전용 크기를 적용한다. 현재 팝업 글씨를 1px씩 키운 사용자 요청을 반영하며 상세 페이지의 공통 크기는 유지한다.

- brand / error title: 14px / 700
- verdict: 23px / 750
- description: 13px / 400 / 1.6
- evidence title / button: 13px / 600
- evidence item / metadata / URL input: 12px
- footer: 11px

---

## 10. Button

### Primary

```css
height: 40px;
padding: 0 16px;
background: var(--color-primary);
color: var(--color-primary-on);
border: 1px solid var(--color-primary);
border-radius: var(--radius-md);
font-size: 14px;
font-weight: 600;
```

Hover:

```css
background: var(--color-primary-hover);
```

Active:

```css
background: var(--color-primary-active);
transform: translateY(1px);
```

### Secondary

```css
height: 40px;
padding: 0 16px;
background: var(--color-surface);
color: var(--color-text-secondary);
border: 1px solid var(--color-border-strong);
border-radius: var(--radius-md);
font-size: 14px;
font-weight: 600;
```

### Focus

```css
outline: none;
box-shadow: 0 0 0 3px var(--color-focus);
```

---

## 11. Input

```css
height: 42px;
padding: 0 12px;
background: var(--color-surface);
color: var(--color-text);
border: 1px solid var(--color-border-strong);
border-radius: var(--radius-md);
font-size: 14px;
```

Focus:

```css
border-color: var(--color-blue);
box-shadow: 0 0 0 3px var(--color-focus);
```

---

## 12. Final Verdict Card

최종 판정은 상세 페이지에서 가장 강한 시각적 우선순위를 가진다.

```css
background: var(--color-surface);
border: 1px solid var(--color-border);
border-radius: var(--radius-lg);
padding: 16px;
```

상태색 적용 위치:

- 상태 아이콘
- 판정 텍스트
- 좌측 accent 또는 작은 badge

카드 전체를 red / amber / green으로 채우지 않는다.

예:

```text
최종 판정

⚠ 위험

로그인 정보를 외부 도메인으로 전송하는 행동과
다단계 리다이렉션이 확인되었습니다.
```

---

## 13. Key Evidence

핵심 근거는 카드 사용을 허용한다.

권장 구조:

```text
핵심 근거

[ Evidence ]
[ Evidence ]
[ Evidence ]
```

Evidence item:

```css
padding: 12px;
border: 1px solid var(--color-border);
border-radius: var(--radius-md);
background: var(--color-surface);
```

Hover:

```css
background: var(--color-surface-hover);
border-color: var(--color-border-strong);
```

텍스트 계층:

```text
외부 도메인으로 로그인 정보 전송   15px / 700
Form Action Domain                  12.5px / 600 / muted
로그인 폼의 전송 대상이 현재...      14px / 400 / 1.6
```

---

## 14. L2 / L3 / L4 Accordion

각 레이어 섹션은 가시적으로 구분되는 흰색 박스로 표시한다.

기본:

```css
background: var(--color-surface);
border: 1px solid var(--color-border);
border-radius: var(--radius-md);
```

박스 사이 간격은 `--space-2`(8px)를 사용한다.

Accordion header:

```text
네트워크 분석           L2    3
```

- 제목: 16px / 700
- 기술 라벨: 12px / 600 / muted
- count badge: 12px / 600

열린 상태에서도 shadow를 추가하지 않는다. 탐지 근거가 0건이어도 L2/L3/L4 박스를 모두 유지한다.

---

## 15. Evidence Detail Item

구조:

```text
사용자용 제목
기술 라벨
[상태 + 펼침 아이콘]

(박스를 펼친 경우)
설명
원시값
```

기본 텍스트:

- title: 15px / 700
- technical label: 12.5px / 600 / muted
- description: 14px / 400 / 1.62 (펼친 상태)

사용자 가시성 피드백에 따라 상세 Evidence는 항목별 흰색 박스로 구분한다.

- 1px `--color-border` 테두리, 8px 곡률, 12px 안쪽 여백을 사용한다.
- 박스 사이 간격은 8px로 유지하고 그림자는 추가하지 않는다.
- L2/L3/L4 콘텐츠에 들여쓰기를 적용하지 않고 박스를 섹션 전체 폭으로 배치한다.
- 접힌 상태에는 제목과 기술 라벨만 표시해 항목 높이를 줄인다.
- 별도의 `상세 보기` 버튼을 두지 않고 항목 헤더 전체를 펼침/접기 버튼으로 사용한다.
- 설명과 원시값은 함께 펼쳐지며 동일한 왼쪽 기준선에 정렬한다.
- 상태 아이콘은 제목 오른쪽에 배치하여 별도의 아이콘 들여쓰기 열을 만들지 않는다.

---

## 16. Raw Data / Technical Values

Raw Data는 기본적으로 숨긴다.

펼쳤을 때 Key-Value UI 사용:

```text
Target URL
https://login-example.net/auth

Current Domain
example.com
```

Key:

```text
13px / 600 / muted
```

Value:

```text
13.5px / 500 / monospace
```

Raw Data container:

```css
border-top: 1px solid var(--color-border);
padding-top: 12px;
```

상세 Evidence 박스 안에서 추가 박스나 들여쓰기 없이 같은 왼쪽 기준선에 표시한다.

JSON 원문을 기본 화면에 직접 노출하지 않는다.

---

## 17. Badge

```css
height: 24px;
padding: 0 8px;
border-radius: var(--radius-pill);
font-size: 12px;
font-weight: 600;
```

Neutral:

```css
background: #f4f4f5;
color: #52525b;
```

Info:

```css
background: var(--color-blue-soft);
color: var(--color-blue);
```

상태 배지는 필요할 때만 사용한다.

---

## 18. Motion

모션은 상태 변화와 조작 결과를 이해시키는 용도를 우선하되, 정보 위계를 자연스럽게 보여주는 짧은 진입 효과도 제한적으로 허용한다.

### Timing / easing

- 일반 UI 전환: `120ms ~ 200ms ease-out`
- Accordion 열기 / 닫기: 최대 `220ms ease-out`
- 결과 및 섹션 진입: `180ms ~ 240ms ease-out`
- Loading indicator 회전: `1s linear infinite`
- Loading indicator와 문구 pulse: `1.8s ease-in-out infinite`

### Fast analysis completion

스캔 상태에서 결과 상태로 바뀔 때 결과 영역 전체에 다음 전환을 한 번 적용한다.

```css
from {
  opacity: 0;
  transform: translateY(4px);
}

to {
  opacity: 1;
  transform: translateY(0);
}
```

- 결과 영역의 기본 전환은 처음 표시될 때 한 번 실행한다.
- 판정 아이콘은 `0.96 → 1` 범위의 짧은 scale 효과를 함께 사용할 수 있다.
- 팝업 결과는 판정, 핵심 근거, 보조 안내, 액션의 시각적 순서에 따라 `50ms` 간격으로 등장한다. 각 블록은 `220ms ease-out` 동안 opacity와 8px 이하의 상향 이동을 사용한다.
- 부분 실패 안내처럼 조건부 블록이 추가되어도 DOM 순서에 따라 자연스럽게 이어서 표시한다.
- 애니메이션과 관계없이 완료 상태는 즉시 screen reader에 전달한다.

### Detailed analysis completion

- 상세 결과 페이지의 제목, 최종 판정, 핵심 근거, 상세 분석, 안내 문구, 푸터를 DOM 순서에 따라 `50ms` 간격으로 표시한다.
- 각 블록은 팝업과 동일한 `220ms ease-out`, opacity 전환, 8px 이하의 상향 이동을 사용한다.
- 최종 판정 아이콘에는 `0.97 → 1` 범위의 1회 scale 효과를 적용한다.
- 로딩, 오류, 취소 상태는 순차 등장 효과 없이 즉시 표시한다.

### Accordion expansion

- L2/L3/L4 레이어 박스는 콘텐츠 높이가 커도 급하게 열리고 닫히지 않도록 높이를 `300ms`의 완만한 easing으로 전환한다. 개별 근거는 `220ms ease-out` 이내로 전환한다.
- 레이어 박스를 닫으면 닫힘 전환이 끝난 뒤 해당 레이어에서 펼쳤던 개별 근거 상태를 초기화한다. 모션 감소 환경에서는 즉시 초기화한다.
- 펼침 완료 후 내용이 viewport를 벗어난 경우에만 최소 거리로 부드럽게 이동한다.
- 펼쳐진 박스가 viewport보다 길면 박스 제목이 보이도록 시작 지점에 맞춘다.
- 모션 감소 환경에서는 즉시 펼치고 동일한 시점 보정만 유지한다.

### Allowed

- Button hover / press
- Accordion open / close
- Loading indicator
- 스캔 중 아이콘과 문구의 낮은 대비 pulse
- 고속 분석 완료 결과의 fade-in + 4px 상향 이동
- 상세 분석 결과 주요 블록의 짧은 stagger fade-in
- 주요 결과 카드와 상세 섹션의 8px 이하 진입 이동
- 판정 아이콘의 3% 이하 1회 scale 효과
- 팝업 완료 결과 블록의 짧은 stagger 효과
- 로딩 아이콘 주변의 낮은 대비 pulse
- copy feedback

### Reduced motion

`prefers-reduced-motion: reduce` 환경에서는 이동·회전 애니메이션을 제거하고 결과를 즉시 표시한다. 상태 변경 안내와 키보드 포커스는 그대로 유지한다.

### Limits

- 과도한 page transition
- glow animation
- 상태와 관계없는 반복 애니메이션
- 12px를 넘는 큰 이동 또는 3%를 넘는 scale 변화
- 배경 전체가 깜빡이거나 강한 색상으로 전환되는 효과
- 사용자의 조작이나 핵심 정보 표시를 애니메이션 종료까지 막는 동작

---

## 19. Responsive Rules

Desktop-first.

### Desktop

```text
max-width: 960px
padding-inline: 32px
```

### Tablet / Mobile

```text
padding-inline: 16px
single column
```

- 카드 full-width
- 긴 기술 값은 줄바꿈 또는 truncate
- 버튼은 필요 시 full-width
- 기술 값 때문에 페이지 전체에 horizontal overflow가 발생하지 않도록 한다.

---

## 20. Accessibility

필수:

- 색상만으로 상태 구분 금지
- focus-visible 제공
- 버튼 최소 높이 40px
- mobile touch target 최소 44px 권장
- Accordion keyboard operation
- Copy button keyboard operation
- 충분한 명암비
- screen reader가 loading / completion / error 상태를 인식 가능해야 함

---

## 21. UI Hierarchy Rules

한 화면에서 우선순위는 다음과 같다.

```text
1. 최종 판정
2. 최종 판정 설명
3. 핵심 근거
4. L2 / L3 / L4 분석
5. Raw technical data
```

Raw Data가 사용자용 판정 설명보다 시각적으로 강해지면 안 된다.

---

## 22. Card Usage Rules

카드 사용:

- 분석 메타 정보
- 최종 판정
- 핵심 근거
- L2 / L3 / L4 카테고리
- 결과 하단 안내 문구

상세 Evidence 항목은 최신 사용자 요청에 따라 개별 테두리 박스로 구분한다.

최종 판정 카드와 상세 Evidence 박스의 테두리는 상태와 관계없이 기본 border token으로 통일한다. 상세 Evidence의 `주의`와 `위험` 상태는 L2/L3/L4 배지와 같은 pill 형태로 표시하고, 각각 `--color-caution-soft`와 `--color-danger-soft` 배경 및 대응 상태 텍스트 색상을 사용한다.

사용자 피드백에 따라 대부분의 설명 텍스트는 배경과 구분되는 박스 안에서 관리한다. 모든 박스는 흰색 surface, 1px border, 8px radius를 공통으로 사용하고 그림자는 추가하지 않는다.

`분석 결과`, `핵심 근거`, `상세 분석`처럼 페이지와 주요 섹션을 구분하는 제목 영역에는 박스를 사용하지 않는다. 페이지 헤더와 푸터도 전체 구조를 나타내므로 박스 밖에 유지한다.

일반 section / divider 사용:

- 진행 상태
- 페이지 제목과 주요 섹션 제목

카드 안에 다시 여러 겹의 카드를 중첩하지 않는다.

---

## 23. Do / Don't

### Do

- 14px 이상의 본문을 유지한다.
- 텍스트 굵기로 위계를 명확하게 만든다.
- 기술 라벨보다 사용자용 설명을 크게 표시한다.
- monospace는 실제 technical value에만 사용한다.
- border와 whitespace로 구조를 만든다.
- 상태색은 제한적으로 사용한다.
- 긴 결과 페이지가 문서처럼 자연스럽게 읽히게 한다.

### Don't

- 11~12px 텍스트를 본문처럼 사용하지 않는다.
- 모든 회색 텍스트를 지나치게 옅게 만들지 않는다.
- Evidence를 작은 카드 여러 개로 과도하게 분할하지 않는다.
- red / amber / green을 큰 면적으로 사용하지 않는다.
- 모든 기술 용어를 monospace로 만들지 않는다.
- 전통적인 보안 대시보드처럼 score gauge, 차트, 위협 지표를 임의 추가하지 않는다.
- 초기 명세에 없는 공유 / Export / History UI를 추가하지 않는다.

---

## 24. Reference Component Tokens

```css
:root {
  --font-ui:
    Inter, Pretendard, -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica,
    Arial, sans-serif;
  --font-mono: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;

  --text-page-title: 26px;
  --text-section-title: 18px;
  --text-card-title: 15px;
  --text-body: 14px;
  --text-meta: 13px;
  --text-tech-label: 12.5px;
  --text-verdict-detail: 32px;
  --text-verdict-popup: 28px;

  --radius-control: 8px;
  --radius-card: 12px;

  --content-width: 960px;
  --popup-width: 340px;
}
```

---

## 25. Final Principle

이 제품은 "보안 경고 화면"이 아니라 **분석 결과를 읽고 근거를 검증하는 도구**처럼 보여야 한다.

따라서 시각 디자인은 다음 순서를 따른다.

```text
가독성
→ 정보 위계
→ 일관성
→ 최소한의 상태 강조
→ 장식
```

장식적 요소보다 사용자가 판정과 근거를 빠르게 이해할 수 있는지를 우선한다.

### Popup type scale refinement

Per the user's follow-up, reduce popup type one step: brand 13px, verdict 22px, summary/buttons 12px, input/evidence/labels 11px, and small notices 10px. Keep footnotes at 10px. Preserve the input/button hit areas and the latest single `스캔 중...` loading state from `UI_SPEC.md`.

---

## 10. Detailed Analysis Page — Visual Refresh (Dark Console)

상세 분석 페이지(`/`, `/analysis/{job_id}`의 완료 결과 화면)에만 적용한다. Popup과 로딩·오류 상태 화면은 기존 규칙을 유지한다.
화면 구조와 UX 흐름은 `UI_SPEC.md`를 그대로 따르며, 이 절은 **시각 표현만** 바꾼다.
앞선 절과 충돌하는 부분은 상세 분석 페이지에서 이 절이 우선한다.

**의도적 예외:** 이 절은 §2의 "피해야 할 방향" 중 어두운 배경·글로우 사용을 팀의 명시적 요청으로 이 페이지에 한해 뒤집는다. 그 대신 §2가 실제로 경계하는 문제들 — 숫자형 위험도 게이지, 모든 기술 라벨에 monospace 사용, 카드 남발, 과도한 빨간 배경 — 은 이 절에서도 그대로 지킨다. 판정은 여전히 3단계 카테고리(안전/주의/위험)로만 표현하고, 실제 데이터에 없는 값(예: 개별 검사 항목별 통과/실패 시각화, 존재하지 않는 리다이렉트 경로)은 절대 새로 만들어 보여주지 않는다.

### 10.1 Direction

- 어두운 콘솔/터미널 톤의 화면. 보안 도구를 다루고 있다는 인상을 판정 신뢰도로 전달한다.
- 페이지 배경은 짙은 네이비이며, 좌상단에 위험(빨강) 톤, 우상단에 중립(파랑) 톤의 은은한 radial glow를 얹는다. 판정 톤과 무관하게 고정된 대기(atmosphere)이며, 판정 색상 자체는 여전히 카드·텍스트에서만 전달한다.
- 페이지는 좌우 2열 구조다: 왼쪽은 판정 요약이 고정(sticky)된 좁은 사이드바, 오른쪽은 근거 목록이 스크롤되는 넓은 콘텐츠 영역이다. 이 페이지에 한해 §8의 한 열 원칙을 되돌린다 — 10.3에서 그 이유와 범위를 명시한다.
- 카드는 늘리지 않는다. 판정 영역(사이드바, 카드 테두리 없음), 레이어별 커버리지 요약 3칸, 핵심 근거 카드 1개, 상세 분석 아코디언만 사용한다 (§2, §22 원칙 유지).
- 파란색은 focus 표시와 L2 레이어 색에만 사용한다. 선택·펼침 상태는 blue 대신 중립색(ink)을 쓴다.

### 10.2 Page background

```text
--color-canvas  #080d19  (페이지 바탕)
--color-surface #0f1729  (카드 배경)

background:
  radial-gradient(900px 500px at 12% -8%,  rgba(239,68,68,0.16), transparent 60%),
  radial-gradient(900px 560px at 100% 0%,  rgba(59,130,246,0.14), transparent 60%),
  var(--color-canvas)
```

기존의 판정 톤별 wash는 더 이상 쓰지 않는다 — 배경 자체가 이미 짙은 색이라 톤별 wash가 잘 보이지 않고, 판정 영역의 accent 색(10.3)이 판정 색을 충분히 전달한다.

헤더(`.site-header`)는 이 페이지에서만 고유 배경·테두리를 지우고 페이지 배경에 바로 얹힌다 — popup과 미리보기 화면의 헤더는 그대로 흰 배경 서페이스를 유지한다.

### 10.3 Page shell: verdict sidebar + findings content

판정 요약, 분석 정보, 대상 URL은 왼쪽의 좁은 사이드바에 고정하고, 레이어 커버리지·핵심 근거·상세 분석은 오른쪽의 넓은 콘텐츠 영역에서 스크롤한다. 사이드바는 화면 스크롤에 따라 함께 붙어있다(sticky). 이것이 이 페이지가 §8의 한 열 원칙을 되돌리는 지점이며, 팀 요청에 따른 의도적 예외다.

```text
.report-shell     grid, columns: minmax(240px, 280px) 1fr, gap 32px (--space-8)
.report-sidebar   position: sticky, flex column, gap 24px (--space-6)
.report-content   나머지 오른쪽 영역
```

화면 폭 `960px` 이하에서는 1열로 쌓인다 (사이드바가 위, 콘텐츠가 아래) — §8이 다른 화면 폭에서 쓰는 것과 같은 반응형 규칙이다.

사이드바 내부는 카드 테두리 없이 세로로 쌓는다: "최종 판정" 라벨 → 판정 아이콘 + 판정 텍스트(`clamp(40px, 9vw, 56px)`) → 안전 등급 탭(10.4) → 판정 설명 → (있는 경우) 분석 한계 → 구분선 → 분석 정보 3줄(10.3a) → 구분선 → 대상 URL. 오른쪽 위 방패 워터마크, emblem, 판정 텍스트 색은 이전과 같은 값을 유지한다 (색 토큰만 다크로 바뀐다).

**10.3a 분석 정보 (사이드바)**

분석 완료 시각·소요 시간·분석 범위 3가지만 한 줄씩 표시한다 (아이콘 + 라벨, 오른쪽에 값). 판정 신뢰도는 이 사이드바에는 표시하지 않는다 — 팀이 준 참고 화면에 포함되지 않아 뺐다; 데이터 자체는 계속 계산되며 다른 화면에서 필요해지면 다시 꺼내 쓸 수 있다.

```text
.sidebar-fact         flex row, justify space-between
.sidebar-fact-label   아이콘(22px 칩) + 라벨, --mute
.sidebar-fact-value   값, --ink, 오른쪽 정렬
```

분석 범위 줄의 값은 레이어 칩(L2/L3/L4)이다. 일부 레이어가 미실행이거나 시험용 데이터를 쓴 경우, 그 아래 작은 텍스트로 "미실행 영역" / "시험용 데이터 사용" 목록을 덧붙인다 (기존 `report.coverage.skipped` / `stubbed` 그대로, 새 데이터 아님).

대상 URL은 사이드바 맨 아래 박스에 둔다. 박스 배경은 `var(--canvas)`(페이지 바탕과 같은 짙은 색)로, 사이드바 안에서 한 단계 파인 패널처럼 보이게 한다.

### 10.4 Tone tabs (categorical)

판정 텍스트 아래에 안전·주의·위험 3칸짜리 탭을 둔다. **숫자형 게이지가 아니다** — 개별 검사 항목의 점수를 합산하거나 시각화하지 않으며, 오직 `report.tone`(현재 판정이 세 값 중 어디에 해당하는지)만 표시한다. 데이터에 없는 세분화된 수치는 만들지 않는다는 원칙(§2, §10 상단 예외 조항)을 지키기 위한 장치다.

```text
.tone-tabs        grid, 3 columns, gap 6px
.tone-tabs span   기본: 테두리만 있는 pill, --faint 텍스트
현재 톤의 칸만 해당 판정색을 배경으로 꽉 채우고, 그 색 위에서 읽히도록 어두운 텍스트를 쓴다
  (safe #052e13 / caution #402700 / danger #4a0a0a — 밝은 판정색 배경 위 텍스트이므로
  다른 다크 테마 텍스트 색 규칙과 다르게 의도적으로 어둡다).
```

`report.tone`이 `unknown`(판단 불가)인 경우 탭을 표시하지 않는다 — 세 등급 중 어디에도 속하지 않는 상태를 억지로 위치시키지 않기 위함이다. 장식 요소이므로 스크린리더에서는 숨긴다(이미 판정 텍스트로 같은 정보를 전달한다).

### 10.5 Layer coverage summary (콘텐츠 영역 상단)

콘텐츠 영역 맨 위, 핵심 근거보다 먼저 레이어(L2/L3/L4)별 요약 카드 3개를 나란히 배치한다. **모두 실제 값이다**: "검사 항목 수"는 `layers[].checked`(기존에 상세 분석 아코디언 안에서도 쓰던 값), "이상 건수"는 해당 레이어에 속한 `evidence`의 개수 — 새로 만든 숫자가 아니라 페이지 다른 곳에서도 쓰는 값을 요약해 보여줄 뿐이다.

```text
.layer-summary-row      grid, 3 columns (700px 이하에서 1열)
.layer-summary-card     surface 배경, radius 14px
.layer-summary-bar      height 6px, radius pill, 기본 배경 --color-border
  danger segment  너비 = (해당 레이어 danger 근거 수 / checked) × 100%
  caution segment 너비 = (해당 레이어 caution 근거 수 / checked) × 100%
```

두 세그먼트 폭의 합이 "이상 비율"이고, 나머지는 특이사항 없이 통과한 검사 비율이다 — 개별 검사 항목 하나하나의 통과/실패를 표시하는 것이 아니라 두 실제 카운트(검사 수·근거 수)의 비율만 그린다는 점에서 §2·상단 예외 조항이 금지하는 "존재하지 않는 세분화된 시각화"가 아니다.

상세 분석 데이터가 없는 응답(판단 불가/시험용/접근 제한)에서는 이 요약 자체를 표시하지 않는다 — 실행되지 않은 분석에 대해 근거 없는 카운트를 보여주지 않기 위함이다.

### 10.6 Key evidence

- 하나의 카드(radius `16px`) 안에 행으로 나열한다. 행마다 별도 카드로 나누지 않는다.
- 행은 5열 grid(`36px minmax(0,1fr) auto auto auto` — 아이콘 · 제목/설명 · 심각도 pill · 레이어 칩 · chevron)로 정렬해, 여러 행이 세로로 표처럼 열이 맞춰 보이게 한다.
- 심각도는 아이콘에 더해 눈에 보이는 pill(`안전/주의/위험` 텍스트 + 점)로 전달한다 — 이전에는 스크린리더 전용 텍스트로만 전달했으나, 참고 화면과 맞추기 위해 시각적으로도 드러낸다.
- hover는 배경색 변화만 사용한다. 이동·확대 효과는 사용하지 않는다.

### 10.7 Analysis layers & evidence items

- 레이어: `surface` 배경(`#0f1729`), radius `16px`. 열린 레이어는 `border-strong` + 옅은 layer color shadow
- 열린 레이어의 count badge는 layer 색 배경 + 흰 글씨
- 근거 항목: `surface-subtle` 배경(`#0b1220`, 카드보다 한 단계 어두운 파인 패널), radius `12px`, 왼쪽에 `3px` 심각도 accent 선
- 심각도 pill 앞에 `6px` 점을 붙인다.

### 10.7a Layer hues (L2 / L3 / L4)

다크 배경에서 충분한 대비를 갖도록 라이트 테마보다 밝은 색으로 바꾼다. 색상환의 의미(파랑=네트워크, 보라=콘텐츠, 청록=클로킹)는 유지한다.

```text
L2 네트워크  Network   --layer #60a5fa  soft rgba(96,165,250,.16)
L3 콘텐츠    FileText  --layer #c4b5fd  soft rgba(167,139,250,.16)
L4 클로킹    Eye       --layer #5eead4  soft rgba(45,212,191,.16)
```

- 판정(위험·주의·안전)의 의미 색과 겹치지 않는 색만 사용한다.

### 10.8 Console typography (limited monospace exception)

§2는 "모든 기술 라벨에 monospace 사용"을 피하라고 하지만, 이 페이지는 콘솔 느낌을 위해 **레이어 태그(L2/L3/L4 칩)에 한해서만** monospace를 쓴다. URL·해시 등 원래부터 monospace였던 기술값(`--font-mono`, §16)은 그대로다. 본문·제목·근거 설명 등 나머지 텍스트는 계속 `--font-ui` (Inter Variable)를 쓴다 — 라벨 전체를 monospace로 바꾸는 것은 여전히 피한다.

### 10.9 Not changed

Popup, 로딩·오류 화면, 타이포그래피 스케일(§4)의 기본값, spacing(§5), 접근성 규칙, 애니메이션 목록은 바꾸지 않는다. 페이지 제목("분석 결과") h1은 문서 구조·접근성을 위해 계속 존재하지만, 참고 화면에 맞춰 시각적으로는 숨긴다(`sr-only`).
