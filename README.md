# LinkGuard — URL 분석 프론트엔드

React + TypeScript + Vite로 구현한 URL 분석 서비스 화면이다. 로그인 후 URL과 분석 옵션을 입력하고, 빠른분석 결과·별도 VirusTotal 참고 결과·심층분석 진행과 보고서를 표시한다.

백엔드: [url_detection](https://github.com/KISIA-AI-Security-Project/url_detection)

## 구성

```text
src/pages/ServicePage.tsx   인증·접수·결과 복원·Fast/Deep SSE 연결
src/components/            입력·로그인·분석 결과·업무·캡처 화면
src/service/               API 계약·클라이언트·세션 인증·내비게이션·스타일
public/config.json         공개 API/Cognito 연결 설정
scripts/                   정적 Front 패키징·배포 도구
tests/                     모델·서비스·인증·사용자 옵션·브라우저 검사
docs/design/               현재 화면의 상세 설계
```

기본 `/` 경로는 실제 서비스의 `ServicePage`다. 기존 팝업·목업·디자인 미리보기는 개발용으로 남아 있으며, 현재 데스크톱 서비스와 구분한다. 화면은 서버가 반환한 판정·사실·업무 상태를 표시하고 자체적으로 재판정하지 않는다.

## 로컬 실행과 빌드

Node.js 22 이상을 권장한다.

```sh
npm ci
npm run dev
npm run build
```

개발 서버의 `/api`는 기존 서비스로 연결된다. `public/config.json`의 Cognito 리다이렉트는 기존 운영 주소이므로, 로컬 인증 검사는 통제된 응답을 사용하는 테스트를 따르고 다른 환경의 실제 로그인에는 별도 등록된 설정이 필요하다. 공개 설정에 모델 키·토큰·비밀번호를 넣지 않는다.

`dist/`는 운영 정적 빌드이며 Git에 올리지 않는다. `scripts/publish_frontend.py`는 승인된 AWS 환경의 정적 파일 적용 도구다. `npm run build` 자체는 배포하지 않는다.

## 검사

```sh
npm test
npx vitest run tests/auth.test.ts tests/session-auth.test.ts tests/user-options.test.tsx
```

Playwright 브라우저 검사는 `tests/*playwright.config.ts`와 각 검사 파일을 사용한다. 통제된 API·인증·SSE 검사는 실제 모델의 판단 품질이나 AWS 신규 분석 완료를 증명하지 않는다.

## 설계와 연결 계약

- [현재 서비스 설계](SERVICE-DESIGN.md): 실제 Fast/Deep 연결, 모델·effort 선택, 선택 질문, 결과 표시
- [인증과 화면 이동](docs/design/auth-and-navigation.md)
- [입력 화면](docs/design/main-entry.md)
- [디자인 기준](DESIGN.md), [화면 명세](UI_SPEC.md), [작업 안내](AGENTS.md)

실제 서비스 연결에서는 `SERVICE-DESIGN.md`의 최신 계약이 기존 목업 전제보다 우선한다. 날짜가 붙은 배포 문서는 당시의 확인 범위이며 현재 소스 전체의 운영 검증 완료를 뜻하지 않는다.
