import {
  useLayoutEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";
import {
  ShieldCheck,
  ShieldX,
  Check,
  TriangleAlert,
  Copy,
  LoaderCircle,
  Info,
  ChevronDown,
  Sun,
  Moon,
} from "lucide-react";
import type { Verdict } from "../lib/types";
import { verdicts } from "../data/results";
export function Brand() {
  return (
    <div className="brand">
      <span className="brand-mark">
        <ShieldCheck size={21} strokeWidth={1.7} />
      </span>
      <span>
        LinkGuard<span className="brand-dot">.</span>
      </span>
    </div>
  );
}
export function Header({ right }: { right?: ReactNode } = {}) {
  return (
    <header className="site-header">
      <div className="header-inner">
        <Brand />
        {right}
      </div>
    </header>
  );
}
export function ThemeToggle({
  theme,
  onToggle,
}: {
  theme: "light" | "dark";
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={onToggle}
      aria-label={theme === "dark" ? "라이트 모드로 전환" : "다크 모드로 전환"}
    >
      {theme === "dark" ? (
        <Sun size={17} strokeWidth={2} />
      ) : (
        <Moon size={17} strokeWidth={2} />
      )}
    </button>
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
export function StatusIcon({
  verdict,
  size = 20,
}: {
  verdict: Verdict;
  size?: number;
}) {
  const Icon =
    verdict === "safe"
      ? ShieldCheck
      : verdict === "caution"
        ? TriangleAlert
        : ShieldX;
  return <Icon aria-hidden="true" size={size} strokeWidth={1.7} />;
}
export function StatusBadge({ verdict }: { verdict: Verdict }) {
  return (
    <span className={`status-badge ${verdict}`}>
      <StatusIcon verdict={verdict} size={15} />
      {verdicts[verdict].text}
    </span>
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
export function Notice({ children }: { children: ReactNode }) {
  return (
    <div className="notice">
      <Info size={16} aria-hidden="true" />
      <span>{children}</span>
    </div>
  );
}
export function TechnicalValue({
  value,
  label,
}: {
  value: string;
  label?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [overflow, setOverflow] = useState(false);
  const codeRef = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const element = codeRef.current;
    if (!element || expanded) return;
    const measure = () =>
      setOverflow(element.scrollWidth > element.clientWidth);
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    measure();
    return () => observer.disconnect();
  }, [value, expanded]);
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
      {label && <span className="value-label">{label}</span>}
      <div className="value-line">
        <code ref={codeRef} className={expanded ? "expanded" : ""}>
          {value}
        </code>
        <button
          className="copy-button"
          onClick={copy}
          aria-label={`${label || "URL"} 복사`}
        >
          <Copy size={14} />
        </button>
      </div>
      <div className="value-actions">
        {(value.length > 64 || overflow || expanded) && (
          <button
            className="text-button"
            aria-expanded={expanded}
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? "접기" : "전체 보기"}
          </button>
        )}
        <span role="status">
          {copyStatus === "copied"
            ? "복사됨"
            : copyStatus === "error"
              ? "복사하지 못했습니다. 직접 선택해주세요."
              : ""}
        </span>
      </div>
    </div>
  );
}
export function DetailsToggle({
  open,
  onClick,
  children,
  controls,
}: {
  open: boolean;
  onClick: () => void;
  children: ReactNode;
  controls: string;
}) {
  return (
    <button
      className="text-button details-toggle"
      aria-expanded={open}
      aria-controls={controls}
      onClick={onClick}
    >
      {children}
      <ChevronDown size={14} className={open ? "rotated" : ""} />
    </button>
  );
}
export function CompleteIcon() {
  return (
    <span className="complete-icon">
      <Check size={13} strokeWidth={2} />
    </span>
  );
}
export function Footer({ preview = false }: { preview?: boolean }) {
  return (
    <footer className="page-footer">
      <div>
        <span>더 나은 판단을 위한, 한 번의 확인.</span>
      </div>
      <span>LinkGuard {preview ? "· 목업 미리보기" : "· 목업 데이터"}</span>
    </footer>
  );
}
