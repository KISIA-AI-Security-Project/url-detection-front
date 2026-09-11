import { Header, Footer } from "../components/ui";
import { ArrowUpRight } from "lucide-react";
import { seedDemo } from "../lib/mock-service";
import { analysisHref } from "../lib/platform";
import type { Scenario } from "../lib/types";
export function PreviewPage() {
  const show = (scenario: Scenario, running = false) => {
    const job = seedDemo(scenario, running);
    window.location.assign(analysisHref(job.id));
  };
  return (
    <>
      <Header />
      <main className="preview-main">
        <span className="eyebrow">DEVELOPMENT PREVIEW</span>
        <h1>화면 미리보기</h1>
        <p>
          API 연결 전, 목업 데이터로 화면과 상태 흐름을 확인할 수 있습니다.
          <br />
          입력한 URL에 실제로 접속하거나 보안 검사를 수행하지 않습니다.
        </p>
        <section>
          <h2>고속 분석 팝업</h2>
          <p>진행 중인 고속 분석은 종료 버튼을 누를 때까지 유지됩니다.</p>
          <div className="preview-options">
            {(
              [
                "danger",
                "fast-danger",
                "caution",
                "safe",
                "partial",
                "failed",
              ] as Scenario[]
            ).map((s, i) => (
              <a key={s} href={`/popup.html?scenario=${s}`}>
                {
                  [
                    "주의 → 위험",
                    "위험 → 위험",
                    "주의 → 주의",
                    "안전",
                    "부분 분석 실패",
                    "분석 실패",
                  ][i]
                }
                <ArrowUpRight size={16} />
              </a>
            ))}
          </div>
        </section>
        <section>
          <h2>심층 분석 결과</h2>
          <div className="preview-options">
            {(
              [
                "danger",
                "caution",
                "safe",
                "partial",
                "summary-fallback",
                "unknown",
                "stub",
                "blocked",
              ] as Scenario[]
            ).map((s, i) => (
              <button key={s} onClick={() => show(s)}>
                {
                  [
                    "위험",
                    "주의",
                    "위험 징후 없음 · 탐지 0건",
                    "부분 분석 실패",
                    "설명 생성 실패 · 기본 문구",
                    "판단 불가 · 가이드 응답 예시",
                    "시험용 데이터 · 판정 제한",
                    "접근 제한 · 미실행 영역",
                  ][i]
                }
                <ArrowUpRight size={16} />
              </button>
            ))}
          </div>
        </section>
        <section>
          <h2>심층 분석 상태</h2>
          <div className="preview-options">
            {(
              ["danger", "reconnecting", "status-error", "failed"] as Scenario[]
            ).map((s, i) => (
              <button key={s} onClick={() => show(s, true)}>
                {
                  [
                    "스캔 중 · 취소 가능",
                    "연결 재시도 · 자동 복구",
                    "상태 조회 오류 · 다시 시도",
                    "심층 분석 실패",
                  ][i]
                }
                <ArrowUpRight size={16} />
              </button>
            ))}
          </div>
        </section>
        <Footer preview />
      </main>
    </>
  );
}
