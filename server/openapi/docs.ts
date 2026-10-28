import type { WsAction } from "../ws/protocol";

export const HTTP_ACTION_PREFIX = "/api/v1/";

export interface ActionDoc {
  tag: string;
  summary: string;
  description: string;
  public?: boolean;
  body?: Record<string, unknown>;
}

export const ACTION_DOCS: Record<WsAction, ActionDoc> = {
  "state:init": {
    tag: "System",
    summary: "Fetch initial session & server state",
    description: "Returns authentication status and current server timestamp.",
    public: true,
  },
  "system:ping": {
    tag: "System",
    summary: "Ping the server",
    description: "Health/latency check available over both WebSocket and HTTP.",
    public: true,
  },
  "system:echo": {
    tag: "System",
    summary: "Echo a message back (optionally broadcast to connected clients)",
    description: "Validates that `message` is non-empty and returns it with a timestamp.",
    public: true,
    body: {
      type: "object",
      required: ["message"],
      properties: {
        message: { type: "string" },
        broadcast: { type: "boolean" },
      },
    },
  },
};

/** "system:ping" -> "/api/v1/system/ping" */
export function httpPathForAction(action: WsAction): string {
  return `${HTTP_ACTION_PREFIX}${action.replace(":", "/")}`;
}

/** "/api/v1/system/ping" -> "system:ping" (only known actions). */
export function actionFromHttpPath(pathname: string): WsAction | null {
  if (!pathname.startsWith(HTTP_ACTION_PREFIX)) return null;
  const parts = pathname
    .slice(HTTP_ACTION_PREFIX.length)
    .replace(/\/+$/, "")
    .split("/");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  const action = `${parts[0]}:${parts[1]}`;
  return Object.prototype.hasOwnProperty.call(ACTION_DOCS, action)
    ? (action as WsAction)
    : null;
}

/** Public API reference page (Scalar UI from CDN, spec from /openapi.json). */
export function renderDocsHtml(): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>API Documentation</title>
  <style>body{margin:0;font-family:system-ui,sans-serif}#fallback{padding:24px;color:#6b7488;font-size:14px}</style>
</head>
<body>
  <div id="app"></div>
  <div id="fallback">Loading API documentation... Raw OpenAPI spec is available at
    <a href="/openapi.json">/openapi.json</a>.</div>
  <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
  <script>
    if (window.Scalar) {
      document.getElementById("fallback").remove();
      Scalar.createApiReference("#app", {
        url: "/openapi.json",
        theme: "default",
        layout: "modern",
        defaultHttpClient: { targetKey: "js", clientKey: "fetch" },
      });
    }
  </script>
</body>
</html>`;
}
