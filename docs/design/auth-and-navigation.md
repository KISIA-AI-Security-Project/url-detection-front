# 이메일 선인증과 서비스 내 로그인

## 화면과 책임

기존 paper/ink/cream·Inter·glass header/button, 440px 한 열을 유지한다. 제목은 회원가입이고 이메일 옆 인증 버튼을 주어진 48px 제어 높이로 정렬한다. 코드 입력은 같은 이메일 아래에 표시한다. 비밀번호는 이메일 인증 전에 비활성화한다. 320/390px에서도 input min-width:0과 96px 보조 버튼을 사용해 잘리지 않는다.

이메일부터 시작해 서버 인증이 완료된 후 비밀번호를 받는 사용자의 순서가 기준이다. ServiceAuth는 메모리에 43자 intent를 만들고 session-auth의 startEmailVerification / confirmEmailVerification / resendEmailVerification / completeRegistration을 호출한다. 호출 경로·서버 cookie·세션 보안은 API/session-auth의 책임이다. Front에서 성공 응답을 만들어 내지 않는다.

`code_sent`, `verified`, `complete`를 구별한다. start/resend 재조회가 verified면 코드 단계를 다시 강요하지 않는다. 이메일 변경은 이전 intent와 password/repeat/code/verified를 모두 무효화한다. pending 응답은 intent와 revision이 현재 화면에 일치할 때만 반영한다. 서버 cooldown/expiry를 실제 시각 기준으로 표시하고 만료 후 제출을 막는다. 확인 버튼 성공 시 다음 초점은 비밀번호로 이동한다.

코드 불일치는 수정, 코드 만료는 재전송으로 복구한다. flow 만료/기존 계정/결과 불명확은 신규 계정 비밀번호 설정으로 우회하지 않고 기존 Cognito 이메일 확인 또는 로그인 화면의 비밀번호 찾기로 안내한다. 기존 계정 이메일 인증은 별도 모드이며 confirmSignUp/resendSignUpCode만 쓴다. 신규 complete를 호출하지 않는다. 서버 연결이 불명확한 confirm/complete는 자동 재전송하거나 성공 표시하지 않는다.

비밀번호 조건은 signupPasswordRules의 8~256자, 지원 ASCII 특수문자, 모든 공백 금지를 따르고 재입력을 비교한다. 비밀번호/code/intent는 browser storage/history/log에 넣지 않는다.

## 로그인과 분석

ServicePage는 session-auth.WebAuth.initialize로 서버 세션을 복원한다. auth.subscribe에서 로그인 성공은 현재 route와 모델 목록을 조회하고 로그아웃·만료는 모든 보호된 작업을 중단한다. 로그인 버튼은 같은 문서의 한국어 이메일·비밀번호 폼을 연다. 인증 제출은 root의 session-auth.login(email,password)를 사용하며 서버가 인증을 검증하고 team5-web/analysis scope를 가진 세션을 발급한다. 브라우저에서 scope를 만들어 붙이거나 JWT 검사를 생략하지 않는다. 성공 알림 전에는 분석을 활성화하지 않는다. 현재 비밀번호에는 가입 helper의 강도 규칙을 적용하지 않으며 원문을 전송하고 요청 종료 뒤 지운다. 비밀번호 보기/숨기기, Enter 제출, 오류 메시지, 중복 제출 차단을 제공한다. Header/Home의 화면 이동은 로그인 처리 중 제한하고 새 창·외부 제공자 이동은 사용하지 않는다. 가입 완료 후 로그인 폼은 이메일만 유지한다. 비밀번호 재설정은 아직 계약이 없으므로 인라인 미지원 안내만 표시한다.

분석 내 push/pop 경계는 기존과 같다. pending Fast Back의 late acceptance, 옛 Fast/Deep SSE는 task 검사를 통과하지 못한다. Back/Forward·새로고침은 기존 ID GET/SSE만 수행한다. persisted pageshow에서는 서버 세션부터 복원하고 subscriber와 추가 복원 중복을 막는다. logout은 기존 보호 작업을 정리하고 서버 폐기 요청 동안 처리 중을 표시한다. popup/redirect 없이 Promise 실패를 사용자에게 보여 주고 local signed-out 상태를 임의 성공으로 바꾸지 않는다.

## 검증 경계

tests/auth-ui.spec.ts는 실제 ServicePage와 session-auth를 사용하며 /api/auth/session 및 신규 signup 응답은 로컬 모형으로 대체한다. 이메일만으로 start, inline 코드, verified 전 password 차단, 이메일 변경/late 응답, cooldown/만료, 기존계정/불명확 결과, start/resend verified 재개, 서비스 내 로그인·reload·세션만료, Back/Forward/기존 POST 수 유지, failed logout을 확인한다. 기존 user-options 및 Builder 재생은 새 session/callback fixture를 사용하면서 이전 모델/effort/Deep 질문 검사를 유지한다.

브라우저 페이지 reload와 history 이동은 실제 동작이며 BFCache 재개는 합성 PageTransitionEvent(persisted=true)이다. 실제 BFCache 적재/운영 복귀를 증명하지 않는다. 실제 계정 생성·이메일·Cognito password 변경·운영 세션 cookie·모델 호출은 로컬 검사로 주장하지 않는다. 배포 뒤 운영 증거와 분리한다.

네이티브 로그인 검사는 실제 Chrome의 두 문서와 native Web Locks를 사용하되 HTTP API는 로컬 모형이다. 로그인 연결 handshake 409를 한 번 이어가는 동작, 잘못된 암호, 로그아웃 후 오류 유지, 새 창/외부 이동 없음, 서버 동적 모델 3개와 effort 표시를 검증한다. 과거 popup callback 경합 검사는 auth-ui-6 고정 증거에 보존하며 새로운 UI의 활성 경로로 합산하지 않는다.
