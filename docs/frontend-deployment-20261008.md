# 확정 Front 운영 적용 — 2026-10-08

대상: https://d2gmygchoew9ed.cloudfront.net/

## 적용한 내용

- 메인: URL 입력·분석 시작·선택 VT·최근 분석 3개/전체 보기/접기.
- 로고와 LinkGuard 이름: 로그인 상태를 유지하며 메인으로 이동한다. 화면 재로드 대신 기존 `backToEntry`를 호출한다.
- 빠른 결과: API 판정·요약·이유, 연결된 사실의 상세정보, 선택 기술정보, 별도 VT 결과.
- 심층 결과: 업무·핵심 확인 내용·브라우저 캡처·총괄 설명·최종 보고.
- API의 5분류와 과거 SUSPICIOUS를 그대로 표시한다. 표시 문구는 기존 공개 계약과 같다.

`ServicePage`는 인증·요청·SSE와 활성 결과를 담당한다. `ServiceEntry`, `ServiceResults`,
`VirusTotalResult`, `RecentAnalyses`와 CSS가 화면을 담당한다. 화면 수정 시 서버의 판정·사실·업무 상태를
재계산하지 않는다. Builder·모델·L4·API·Cognito 설정은 이번 배포에서 수정하지 않았다.

## 배포 증거

- 소스 기준 commit: `3b8af40e8e63d211ec4eb3aff9b14205756b4027` + 이번 Front 연결 diff.
- 로컬 검사: 71개 통과, TypeScript/Vite 운영 빌드 및 `git diff --check` 통과.
- 독립 검토: 고정 diff·ZIP·공개 계약·배포 범위를 읽고 차단 결함 없음. 실제 AWS 수신 증거와 구분했다.
- 최초 ZIP SHA-256: `3869cebe44cdcdbd2e4a94f543c6273b42b5462f8eae83014fec50f1be29b4cb`.
- 로고 요청을 반영한 최종 ZIP SHA-256: `396f74afd3aa7f2cf3f01f025199f96a5df2b191ed5a06cd9657a8c3508c68b7`.
- 최종 index SHA-256: `e59ee0ce3e43926e7b68ed442479b742e5361114e69aa358e25b8966ca0f19b3`.
- 이전 index SHA-256: `6a2db8bb644974feaedb0670284bb094a5d5730e5ed37d361071d828f6f36452`.
- 기존 설정 일치와 정적 파일 12개의 S3 저장 후 읽기 확인. index를 마지막에 교체했다.
- 백업: `s3://team5-evidence-998301375101-ap-northeast-2-an/web/frontend/20261006/releases/20261007T151838349378Z/index.html` 및 같은 위치의 config.json.
- 로고 변경 전 화면의 추가 백업: `web/frontend/20261006/releases/20261007T152622350605Z/index.html`.
- 최종 CloudFront 무효화: `ICJLFAU9UCB3F3WCVTZQ8QSBHA`, `Completed` 확인.

## 실제 화면 확인

- 사용자의 기존 Cognito 로그인과 실제 최근 분석 기록을 받았다. 기본 3개와 전체 보기 전환을 확인했다.
- 저장된 Blender 빠른 결과와 악성 판정 기록에서 판정·이유·연결된 사실·기술정보 표시를 확인했다.
- Blender의 심층분석 버튼으로 저장된 실제 심층 결과를 받았다. 최종 보고·업무 확장·업무 결론·브라우저 캡처가 표시됐다. 이 확인은 기존 결과의 서비스 연결이며 새 L4 실행 품질 평가가 아니다.
- 심층 화면에서 로고를 눌러 메인으로 돌아왔고 로그인 상태와 최근 기록이 유지됐다.
- 최종 배포 화면에서 `https://www.iana.org/` 빠른분석과 VT를 함께 요청했다. job `a5091438383b4ac79b08b55119c9d16b`의 실제 새 결과가 `정상`으로 표시됐고 VT는 별도 영역에 `위험 0개 · 의심 0개`를 표시했다. 결과 수신 이후 추가 분석은 요청하지 않았다.
- 실제 캡처: `deployed-main.jpg`, `deployed-fast-vt.jpg`, `deployed-deep.jpg`.

이 검증은 Front의 실제 요청·수신·표시 연결을 확인한 것이다. 모델 판정 정확도나 모든 URL의 성능을 검증한 것은 아니다.

패키지와 배포 영수증: 프로젝트 `output/frontend-service-20261008/`.

## 원복

기존 CloudShell에서 최종 ZIP을 풀어 둔 `/tmp/front-service-20261008-002`의
`scripts/publish_frontend.py --phase rollback`에 위 백업 key와 현재 index hash를 전달한다.
예상 hash가 일치할 때만 이전 index를 복구한다. 기존 정적 자산은 삭제하지 않았다.
