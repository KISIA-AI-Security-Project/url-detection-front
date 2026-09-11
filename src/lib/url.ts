/** Normalize HTTP(S) targets without discarding the path, query, or fragment. */
export function normalizeUrl(input: string): string | null {
  const value = input.trim();
  if (!value || /\s/.test(value)) return null;
  const hasPortWithoutProtocol = /^[^/?#:]+:\d+(?:[/?#]|$)/.test(value);
  if (
    /^[a-z][a-z\d+.-]*:/i.test(value) &&
    !/^https?:\/\//i.test(value) &&
    !hasPortWithoutProtocol
  )
    return null;
  try {
    const url = new URL(
      /^https?:\/\//i.test(value) ? value : `https://${value}`,
    );
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password
    )
      return null;
    if (
      !url.hostname ||
      (!url.hostname.includes(".") &&
        url.hostname !== "localhost" &&
        !url.hostname.startsWith("["))
    )
      return null;
    return url.href;
  } catch {
    return null;
  }
}
export function displayHost(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}
export function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  const n = (v: number) => String(v).padStart(2, "0");
  return `${date.getFullYear()}.${n(date.getMonth() + 1)}.${n(date.getDate())} ${n(date.getHours())}:${n(date.getMinutes())}`;
}
export function formatDuration(milliseconds: number): string {
  if (!Number.isFinite(milliseconds) || milliseconds < 0) return "확인 불가";
  const tenths = Math.round(milliseconds / 100);
  const minutes = Math.floor(tenths / 600);
  const seconds = (tenths % 600) / 10;
  if (!minutes) return `${seconds}초`;
  return seconds ? `${minutes}분 ${seconds}초` : `${minutes}분`;
}
