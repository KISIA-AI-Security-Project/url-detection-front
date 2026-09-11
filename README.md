# LinkGuard — URL 분석 프론트엔드

Chrome 확장 프로그램 팝업과 심층 분석 결과 화면을 구현한 React + TypeScript 프로젝트입니다. `DESIGN.md`, `UI_SPEC.md`, `AGENTS.md`를 프로젝트 루트에 보관하며 후속 작업에서도 우선 참조합니다.

**현재는 API 없는 목업입니다. 입력 URL을 실제로 요청하거나 보안 검사를 수행하지 않습니다. 판정·근거는 선택된 시나리오의 예시이며 실제 안전성을 의미하지 않습니다.**

## 로컬 실행

Node.js 22 이상을 권장합니다.

```sh
npm install
npm run dev
```

- `http://127.0.0.1:5173/` — 완성된 상세 분석 결과 예시
- `http://127.0.0.1:5173/popup.html` — 340px 팝업 웹 미리보기
- `http://127.0.0.1:5173/preview` — 개발용 상태별 미리보기: 안전·주의·위험, 부분 실패, 취소, 연결 재시도, 실패, 설명 기본 문구
- `/analysis/{job_id}` — 실제로 생성한 목업 분석의 상태 및 결과

웹 팝업 미리보기에서는 다른 브라우저 탭의 URL을 읽을 수 없으므로 URL을 직접 입력합니다. 기본 고속 분석 시나리오는 `주의 → 위험`이며, `/preview`에서 다른 시나리오를 선택할 수 있습니다. 기존 팝업 결과가 남아 있으면 먼저 `종료`를 누르세요.

## Chrome 확장 프로그램으로 실행

```sh
npm run build:extension
```

1. Chrome 주소창에 `chrome://extensions`를 입력합니다.
2. 우측 상단 **개발자 모드**를 켭니다.
3. **압축해제된 확장 프로그램을 로드합니다**를 클릭합니다.
4. 이 프로젝트의 **`dist-extension` 폴더**를 선택합니다. 프로젝트 루트나 `dist`가 아닙니다.
5. Chrome 확장 프로그램 메뉴에서 **LinkGuard**를 고정합니다.
6. 일반 HTTP/HTTPS 웹사이트를 열고 LinkGuard 아이콘을 클릭합니다.
7. 자동 입력된 현재 탭 URL로 `분석 시작`을 누릅니다. 결과의 `심층 분석`은 별도 탭을 엽니다.

개발 서버를 실행하지 않아도 확장 프로그램 빌드는 독립적으로 동작합니다. Chrome 설정 페이지, 새 탭, 파일 등 지원하지 않는 주소에서는 입력란이 비어 있습니다. 다른 HTTP/HTTPS URL을 직접 입력하면 분석을 시작할 수 있습니다.

코드 수정 후에는 `npm run build:extension`을 다시 실행하고, `chrome://extensions`의 LinkGuard 카드에서 새로고침을 누릅니다. 기존 상세 분석 탭도 새로고침하면 새 코드가 반영됩니다.

웹에서는 `/analysis/{job_id}`를 사용합니다. Chrome 확장은 정적 파일로 실행되므로 동일 화면을 `index.html#/analysis/{job_id}`로 엽니다. 두 형식 모두 분석 대상 URL을 주소에 포함하지 않습니다.

## Vercel 배포

저장소를 Vercel 프로젝트로 가져오면 루트의 `vercel.json`이 Vite 빌드 명령과 `dist` 출력 폴더를 자동으로 적용합니다. 별도의 환경 변수는 필요하지 않습니다.

Vercel 대시보드에서는 저장소 루트를 Root Directory로 선택한 뒤 그대로 배포하면 됩니다. `/analysis/{job_id}`와 `/preview`를 직접 열거나 새로고침해도 SPA 진입점으로 연결되며, `/popup`은 팝업 웹 미리보기로 연결됩니다.

CLI를 사용하는 경우:

```sh
npx vercel
```

프로덕션 배포 전 로컬 확인:

```sh
npm ci
npm run build
```

## 구현된 동작

- URL 검증, HTTPS 자동 보완, 명시적 HTTP 및 경로·쿼리·fragment 보존
- 한 번에 하나의 고속 분석, `스캔 중...` 로딩 표시, 팝업 재오픈 시 복구
- 안전·주의·위험 판정, 고속 근거 최대 3개, 상세 근거 최대 5개
- 심층 분석 새 탭, 자동 완료 전환, 상태 복구, 취소 결과 유지
- 일시적인 연결 오류와 실제 분석 실패를 구분한 화면
- L2/L3/L4 아코디언, 최다 탐지 영역 기본 펼침, 동률 시 L4 → L3 → L2
- 핵심 근거에서 상세 항목으로 이동 및 키보드 포커스
- 원시값 접기·펼치기, 긴 값 전체 보기, 복사 후 인라인 피드백
- URL·도메인은 일반 텍스트로 표시
- 반응형, 키보드 조작, 포커스 표시, 스크린리더 상태 알림, 모션 감소 설정 지원

## 코드 구조 및 API 연결 지점

```text
src/
  components/ui.tsx         공통 UI 컴포넌트
  data/results.ts          목업 결과 및 표시용 데이터 매핑·근거 정렬
  lib/types.ts             분석 모델 및 서비스 인터페이스
  lib/mock-service.ts      목업 분석 생성·조회·취소·저장
  lib/platform.ts          Chrome 활성 탭 및 상세 탭 연결
  lib/url.ts               URL 검증·정규화
  pages/PopupPage.tsx       고속 분석 팝업
  pages/AnalysisPage.tsx    심층 분석 상태 및 결과
  pages/PreviewPage.tsx     개발용 시나리오 미리보기
  styles.css               디자인 토큰 및 반응형 스타일
```

백엔드 준비 후 `AnalysisService`와 `mock-service.ts`를 비동기 API 어댑터로 교체하고 `results.ts`에 실제 응답 → 표시 모델 매핑을 연결하세요. 현재 데이터는 동일 브라우저·동일 origin의 `localStorage`에 저장됩니다. 웹과 확장 프로그램의 저장 공간은 서로 독립적입니다.

목업의 진행 상태는 저장된 시작·종료 시각을 기준으로 계산합니다. 팝업을 닫아도 재오픈 시 경과한 시간이 반영되지만 실제 백그라운드 보안 분석 작업은 실행하지 않습니다. 실제 서비스에서는 서버 작업 또는 확장 프로그램 서비스 워커가 분석을 담당해야 합니다. 브라우저 데이터 삭제나 확장 프로그램 삭제 시 목업 결과는 사라집니다.

최신 `DESIGN.md`는 사용자 제공 `DESIGN (3).md`를 기준으로 하며, 이후 글씨 크기 축소 피드백을 반영했습니다. 팝업과 상세 페이지 모두 로컬 Inter 폰트, 14px 본문, 8px 컨트롤, 12px 주요 카드와 공통 색상 토큰을 사용합니다. 안전은 초록색, 주의는 앰버, 위험은 빨간색으로 아이콘과 판정 문구에 표시합니다. 상세 화면은 최대 960px 한 열 레이아웃이며, monospace는 URL 등 기술 값에만 적용합니다. 한국어는 Pretendard 및 시스템 sans-serif fallback으로 표시합니다.

## 빌드 및 검증

```sh
npm run build             # 웹 → dist/
npm run build:extension   # Chrome 확장 → dist-extension/
npm run preview           # 웹 프로덕션 빌드 미리보기
npm test                  # URL·상태 복구·취소·근거 정렬 단위 테스트
npm run test:e2e          # Chrome 기반 브라우저 테스트
```

브라우저 테스트에는 설치된 Google Chrome을 사용합니다. 웹 배포 시 `/analysis/*` 요청을 `index.html`로 보내는 SPA fallback이 필요합니다. Chrome 확장용 빌드를 웹 서버 배포용으로 사용하지 마세요.

### 팝업 디자인 기준

팝업에도 현재 `DESIGN.md`를 공통 적용합니다. 이전 `docs/design/popup-reference.html`은 과거 참조 자료이며 현재 스타일을 덮어쓰지 않습니다. 340px 단일 열과 최대 540px 내부 스크롤, 고속 분석의 `스캔 중...` 표시를 유지합니다.
