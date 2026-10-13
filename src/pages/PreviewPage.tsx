import { Header, Footer } from "../components/ui";

export function PreviewPage() {
  return (
    <>
      <Header />
      <main className="preview-main">
        <span className="eyebrow">DEVELOPMENT PREVIEW</span>
        <h1>팝업 미리보기</h1>
        <p>
          API 연결 전, 목업 데이터로 화면과 상태 흐름을 확인할 수 있습니다.
          <br />
          입력한 URL에 실제로 접속하거나 보안 검사를 수행하지 않습니다.
        </p>
        <section>
          <h2>팝업 상태</h2>
          <p>
            로그인, 입력, 진행, 결과, 오류 상태를 로컬 목업 데이터로 바로
            확인합니다.
          </p>
          <div className="preview-options">
            {[
              ["signed-out", "로그인 안됨"],
              ["idle", "URL 입력"],
              ["scanning", "분석 중"],
              ["result", "분석 결과"],
              ["error", "분석 오류"],
            ].map(([state, label]) => (
              <a key={state} href={`/popup.html?preview=${state}`}>
                {label}
              </a>
            ))}
          </div>
        </section>
        <Footer preview />
      </main>
    </>
  );
}
