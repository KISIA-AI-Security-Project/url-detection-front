import { Component, StrictMode, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { AnalysisPage } from "./pages/AnalysisPage";
import { DeepAnalysisPage } from "./pages/DeepAnalysisPage";
import { PopupPage } from "./pages/PopupPage";
import { PreviewPage } from "./pages/PreviewPage";
import { ServicePage } from "./pages/ServicePage";
import { DesignPreviewPage } from "./pages/DesignPreviewPage";
import { MainPreviewPage } from "./pages/MainPreviewPage";
import { AuthPreviewPage } from "./pages/AuthPreviewPage";
import "./fonts.css";
import "./styles.css";
import "./service/service.css";
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
const path = /^#\/(analysis|deep)\//.test(window.location.hash)
  ? window.location.hash.slice(1)
  : window.location.pathname;
const match = path.match(/^\/analysis\/([^/]+)\/?$/);
const deepMatch = path.match(/^\/deep\/([^/]+)\/?$/);
const page =
  (import.meta.env.DEV || import.meta.env.MODE === "extension") &&
  (path === "/popup.html" || path === "/popup") ? (
    <PopupPage />
  ) : import.meta.env.DEV && path === "/preview" ? (
    <PreviewPage />
  ) : import.meta.env.DEV && path === "/design-preview" ? (
    new URLSearchParams(window.location.search).get("screen") === "home" ? (
      <MainPreviewPage />
    ) : (
      <DesignPreviewPage />
    )
  ) : import.meta.env.DEV && path === "/auth-preview" ? (
    <AuthPreviewPage />
  ) : import.meta.env.DEV && deepMatch ? (
    <DeepAnalysisPage id={decodeURIComponent(deepMatch[1])} />
  ) : match && /^[0-9a-f]{32}$/.test(match[1]) ? (
    <ServicePage />
  ) : import.meta.env.DEV && match ? (
    <AnalysisPage id={decodeURIComponent(match[1])} />
  ) : import.meta.env.DEV && path === "/original" ? (
    <AnalysisPage />
  ) : path === "/" || path === "/index.html" || path === "/service" ? (
    <ServicePage />
  ) : (
    <>
      <ServiceNotFound />
    </>
  );
function ServiceNotFound() {
  return (
    <main className="state-main">
      <h1>화면을 찾을 수 없습니다.</h1>
      <a href="/">분석 요청으로 돌아가기</a>
    </main>
  );
}
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>{page}</ErrorBoundary>
  </StrictMode>,
);
