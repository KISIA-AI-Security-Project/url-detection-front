import { useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Copy, LoaderCircle } from "lucide-react";
export function Brand({ onHome }: { onHome?: () => void } = {}) {
  const content = (
    <>
      <img className="brand-mark" src="/logo.png" alt="" />
      <span>
        LinkGuard<span className="brand-dot">.</span>
      </span>
    </>
  );
  return onHome ? (
    <button type="button" className="brand brand-home" onClick={onHome} aria-label="LinkGuard 메인 화면으로">
      {content}
    </button>
  ) : <div className="brand">{content}</div>;
}
export function Header({
  actions,
  wide = false,
  onHome,
}: { actions?: ReactNode; wide?: boolean; onHome?: () => void } = {}) {
  return (
    <header className="site-header">
      <div className={`header-inner${wide ? " header-wide" : ""}`}>
        <Brand onHome={onHome} />
        {actions && (
          <div className="header-actions" data-lg-role="dock">
            {actions}
          </div>
        )}
      </div>
    </header>
  );
}
export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary";
}) {
  return (
    <button className={`button button-${variant} ${className}`} {...props} />
  );
}
export function Spinner({ size = 20 }: { size?: number }) {
  return (
    <LoaderCircle
      aria-hidden="true"
      size={size}
      className="spinner"
      strokeWidth={1.6}
    />
  );
}
// Always renders the full value, wrapped; URLs are never shortened.
export function TechnicalValue({
  value,
  label,
  hideLabel = false,
  copyable = true,
}: {
  value: string;
  label?: string;
  hideLabel?: boolean;
  copyable?: boolean;
}) {
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "error">(
    "idle",
  );
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopyStatus("copied");
    } catch {
      setCopyStatus("error");
    }
    window.setTimeout(() => setCopyStatus("idle"), 2000);
  };
  return (
    <div className="technical-value">
      {label && !hideLabel && <span className="value-label">{label}</span>}
      <div className="value-line">
        <code>{value}</code>
        {copyable && (
          <button
            className="copy-button"
            onClick={copy}
            aria-label={`${label || "URL"} 복사`}
          >
            <Copy size={14} />
          </button>
        )}
      </div>
      {copyable && (
        <span className="value-status" role="status">
          {copyStatus === "copied"
            ? "복사됨"
            : copyStatus === "error"
              ? "복사하지 못했습니다. 직접 선택해주세요."
              : ""}
        </span>
      )}
    </div>
  );
}
export function Footer({ preview = false }: { preview?: boolean }) {
  return (
    <footer className="page-footer">
      <span>LinkGuard {preview ? "· 목업 미리보기" : "· 목업 데이터"}</span>
    </footer>
  );
}
