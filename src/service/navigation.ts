export type ServiceRoute =
  | { view: "entry" | "pending" }
  | { view: "fast"; scan: string }
  | { view: "deep"; scan: string; run: string };
type ServiceHistory = {
  linkguard: 1;
  route: ServiceRoute;
  previous?: ServiceRoute;
};
const scanPattern = /^[0-9a-f]{32}$/;
const runPattern = /^[A-Za-z0-9_-]{1,128}$/;
export function readRoute(): ServiceRoute {
  const params = new URLSearchParams(location.search);
  const scan =
    params.get("analysis") ||
    location.pathname.match(/^\/analysis\/([0-9a-f]{32})\/?$/)?.[1];
  const run = params.get("deep");
  if (scan && scanPattern.test(scan))
    return run && runPattern.test(run)
      ? { view: "deep", scan, run }
      : { view: "fast", scan };
  return history.state?.linkguard === 1 &&
    history.state?.route?.view === "pending"
    ? { view: "pending" }
    : { view: "entry" };
}
function routeUrl(route: ServiceRoute) {
  if (!("scan" in route)) return "/";
  const params = new URLSearchParams({ analysis: route.scan });
  if (route.view === "deep") params.set("deep", route.run);
  return "/?" + params;
}
export function sameRoute(left: ServiceRoute | undefined, right: ServiceRoute) {
  return JSON.stringify(left) === JSON.stringify(right);
}
export function writeRoute(route: ServiceRoute, replace = false) {
  const previous =
    history.state?.linkguard === 1
      ? replace
        ? history.state.previous
        : readRoute()
      : undefined;
  const state: ServiceHistory = {
    linkguard: 1,
    route,
    ...(previous ? { previous } : {}),
  };
  history[replace ? "replaceState" : "pushState"](state, "", routeUrl(route));
}
export function anchorRoute(route: ServiceRoute) {
  if (history.state?.linkguard === 1) return;
  writeRoute({ view: "entry" }, true);
  if ("scan" in route) writeRoute({ view: "fast", scan: route.scan });
  if (route.view === "deep") writeRoute(route);
}
export function hasPreviousRoute(route: ServiceRoute) {
  return (
    history.state?.linkguard === 1 && sameRoute(history.state.previous, route)
  );
}
