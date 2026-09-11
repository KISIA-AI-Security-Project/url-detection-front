import { Component, StrictMode, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { AnalysisPage } from "./pages/AnalysisPage";
import { PopupPage } from "./pages/PopupPage";
import { PreviewPage } from "./pages/PreviewPage";
import "./fonts.css";
import "./styles.css";
class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: boolean }
> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    return this.state.error ? (
      <main className="state-main">
        <h1>화면을 불러오지 못했습니다.</h1>
        <p>브라우저의 저장 공간 설정을 확인한 뒤 새로고침해주세요.</p>
        <button
          className="button button-secondary"
          onClick={() => window.location.reload()}
        >
          다시 시도
        </button>
      </main>
    ) : (
      this.props.children
    );
  }
}
const path = window.location.hash.startsWith("#/analysis/")
  ? window.location.hash.slice(1)
  : window.location.pathname;
const match = path.match(/^\/analysis\/([^/]+)\/?$/);
const page =
  path === "/popup.html" || path === "/popup" ? (
    <PopupPage />
  ) : path === "/preview" ? (
    <PreviewPage />
  ) : match ? (
    <AnalysisPage id={decodeURIComponent(match[1])} />
  ) : path === "/" || path === "/index.html" ? (
    <AnalysisPage />
  ) : (
    <AnalysisPage id="not-found" />
  );
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>{page}</ErrorBoundary>
  </StrictMode>,
);
