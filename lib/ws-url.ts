/**
 * WebSocket endpoint for the browser. Always same-origin `/ws`:
 * - `next dev` proxies /ws to the Bun server (see next.config.ts rewrites),
 * - the compiled binary serves the UI and /ws from the same port,
 * - reverse proxies / tunnels only need to forward one origin.
 * `?ws=` overrides it for debugging.
 */
export function resolveWsUrl(loc: {
  protocol: string;
  host: string;
  search: string;
}): string {
  const override = new URLSearchParams(loc.search).get("ws");
  if (override) return override;
  const proto = loc.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${loc.host}/ws`;
}
