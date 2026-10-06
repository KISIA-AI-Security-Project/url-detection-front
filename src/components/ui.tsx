import { useState, type ButtonHTMLAttributes } from "react";
import { Copy, LoaderCircle } from "lucide-react";
export function Brand() {
  return (
    <div className="brand">
      <img className="brand-mark" src="/logo.png" alt="" />
      <span>
        LinkGuard<span className="brand-dot">.</span>
      </span>
    </div>
  );
}
export function Header() {
  return (
    <header className="site-header">
      <div className="header-inner">
        <Brand />
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
}: {
  value: string;
  label?: string;
  hideLabel?: boolean;
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
        <button
          className="copy-button"
          onClick={copy}
          aria-label={`${label || "URL"} 복사`}
        >
          <Copy size={14} />
        </button>
      </div>
      <span className="value-status" role="status">
        {copyStatus === "copied"
          ? "복사됨"
          : copyStatus === "error"
            ? "복사하지 못했습니다. 직접 선택해주세요."
            : ""}
      </span>
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
