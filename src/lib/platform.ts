export const isExtension = () =>
  typeof chrome !== "undefined" && !!chrome.runtime?.id;
export async function activeTabUrl(): Promise<string> {
  if (!isExtension()) return "";
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    return tab?.url && /^https?:\/\//i.test(tab.url) ? tab.url : "";
  } catch {
    return "";
  }
}
export function analysisHref(id: string): string {
  return isExtension()
    ? chrome.runtime.getURL(`index.html#/analysis/${encodeURIComponent(id)}`)
    : `/analysis/${encodeURIComponent(id)}`;
}
export function openAnalysis(id: string): boolean {
  const url = analysisHref(id);
  if (isExtension()) {
    void chrome.tabs.create({ url });
    return true;
  }
  const opened = window.open(url, "_blank");
  if (opened) opened.opener = null;
  return !!opened;
}
