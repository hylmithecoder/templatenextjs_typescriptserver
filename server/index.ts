import path from "node:path";
import type { BunServer, BunServerWebSocket, BunSqlClient } from "./bun-env";
import { EMBEDDED_ASSETS } from "./embedded-assets";
import { actionFromHttpPath, renderDocsHtml } from "./openapi/docs";
import { buildOpenApiSpec } from "./openapi/spec";
import {
  AuthRequiredError,
  PermissionError,
  type ActionContext,
  type AuthUser,
} from "./ws/context";
import { handleWsAction } from "./ws/handlers";
import type {
  WsAction,
  WsBroadcastEvent,
  WsRequestMessage,
  WsResponseMessage,
} from "./ws/protocol";

export interface WsClientData {
  clientId: string;
  connectedAt: number;
  origin: string;
  user: AuthUser | null;
  token: string | null;
}

type Client = BunServerWebSocket<WsClientData>;

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function originOf(value: string | undefined | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(
      value.replace(/^wss:\/\//i, "https://").replace(/^ws:\/\//i, "http://"),
    );
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function getAllowedOrigins(port: number): string[] {
  const configured = [
    process.env.APP_PUBLIC_URL,
    ...(process.env.PUBLIC_ORIGINS || "").split(","),
    process.env.NEXT_PUBLIC_WS_URL,
  ]
    .map((v) => originOf(v?.trim()))
    .filter((v): v is string => Boolean(v));
  const local = [3000, port].flatMap((p) => [
    `http://localhost:${p}`,
    `http://127.0.0.1:${p}`,
  ]);
  return [...new Set([...configured, ...local])];
}

export function resolvePublicOrigin(req: Request, allowed: string[]): string {
  const candidates = [
    req.headers.get("origin"),
    (() => {
      const host =
        req.headers.get("x-forwarded-host") || req.headers.get("host");
      const proto = req.headers.get("x-forwarded-proto") || "http";
      return host ? `${proto}://${host}` : null;
    })(),
  ];
  for (const c of candidates) {
    const o = originOf(c);
    if (o && allowed.includes(o)) return o;
  }
  return allowed[0];
}

const decodedAssetCache = new Map<string, { mime: string; bytes: Uint8Array }>();

function tryServeEmbeddedAsset(pathname: string): Response | null {
  const cleanPath =
    pathname === "/" ? "/index.html" : pathname.replace(/\/+$/, "");
  for (const key of [
    cleanPath,
    `${cleanPath}.html`,
    `${cleanPath}/index.html`,
  ]) {
    let cached = decodedAssetCache.get(key);
    if (!cached) {
      const entry = EMBEDDED_ASSETS[key];
      if (entry) {
        cached = {
          mime: entry.mime,
          bytes: new Uint8Array(Buffer.from(entry.base64, "base64")),
        };
        decodedAssetCache.set(key, cached);
      }
    }
    if (cached) {
      return new Response(cached.bytes as unknown as BodyInit, {
        headers: {
          "Content-Type": cached.mime,
          "Cache-Control": key.startsWith("/_next/static/")
            ? "public, max-age=31536000, immutable"
            : "no-cache",
        },
      });
    }
  }
  return null;
}

async function tryServeStaticFrontend(
  pathname: string,
  staticDir?: string,
  preferDiskDir = false,
): Promise<Response | null> {
  if (!preferDiskDir) {
    const embeddedRes = tryServeEmbeddedAsset(pathname);
    if (embeddedRes) return embeddedRes;
  }
  if (staticDir) {
    const normalizedRoot = path.resolve(staticDir);
    const cleanRel =
      pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
    for (const candidate of [
      path.resolve(normalizedRoot, cleanRel),
      path.resolve(normalizedRoot, `${cleanRel}.html`),
      path.resolve(normalizedRoot, cleanRel, "index.html"),
    ]) {
      if (!candidate.startsWith(normalizedRoot)) continue;
      const f = Bun.file(candidate);
      if (await f.exists()) {
        return new Response(f as unknown as BodyInit, {
          headers: { "Content-Type": f.type || "application/octet-stream" },
        });
      }
    }
  }
  return preferDiskDir ? tryServeEmbeddedAsset(pathname) : null;
}

function send(ws: Client, payload: unknown) {
  try {
    ws.send(JSON.stringify(payload));
  } catch {
    // socket already closed
  }
}

export async function startServer(options?: {
  hostname?: string;
  port?: number;
  sql?: BunSqlClient;
  staticDir?: string;
}): Promise<BunServer<WsClientData>> {
  const hostname =
    options?.hostname ?? process.env.APP_SERVER_HOST ?? "0.0.0.0";
  const port = options?.port ?? Number(process.env.APP_SERVER_PORT || 5790);
  const hasExplicitStaticDir = Boolean(options?.staticDir);
  const staticDir =
    options?.staticDir ??
    process.env.STATIC_WEB_DIR ??
    path.resolve(process.cwd(), "out");

  const clients = new Set<Client>();
  let allowedOrigins = getAllowedOrigins(port);

  function broadcastEvent(action: WsAction, data: unknown) {
    const eventPayload: WsBroadcastEvent = {
      type: "event",
      event: action,
      data,
      timestamp: new Date().toISOString(),
    };
    for (const c of clients) {
      send(c, eventPayload);
    }
  }

  async function handleHttpAction(
    req: Request,
    action: WsAction,
  ): Promise<Response> {
    const json = (status: number, body: unknown) =>
      Response.json(body, { status, headers: CORS_HEADERS });
    let payload: Record<string, unknown> = {};
    try {
      const text = await req.text();
      payload = text ? (JSON.parse(text) as Record<string, unknown>) : {};
      if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
        throw new Error();
      }
    } catch {
      return json(400, { ok: false, error: "Request body must be a JSON object" });
    }

    const token =
      (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "") ||
      null;
    const ctx: ActionContext = {
      sql: options?.sql,
      user: null,
      sessionToken: token,
      origin: resolvePublicOrigin(req, allowedOrigins),
    };

    try {
      const res = await handleWsAction(ctx, action, payload);
      if (res.broadcast) {
        broadcastEvent(action, res.result);
      }
      return json(200, { ok: true, action, data: res.result });
    } catch (err) {
      const error = err instanceof Error ? err.message : "Unexpected error";
      const status =
        err instanceof AuthRequiredError
          ? 401
          : err instanceof PermissionError
            ? 403
            : 400;
      return json(status, { ok: false, action, error });
    }
  }

  const server = Bun.serve<WsClientData>({
    hostname,
    port,
    async fetch(req, srv) {
      if (req.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: CORS_HEADERS });
      }
      const url = new URL(req.url);

      if (url.pathname === "/ws") {
        const upgraded = srv.upgrade(req, {
          data: {
            clientId: crypto.randomUUID(),
            connectedAt: Date.now(),
            origin: resolvePublicOrigin(req, allowedOrigins),
            user: null,
            token: null,
          },
        });
        if (upgraded) return undefined;
        return new Response("WebSocket upgrade failed", {
          status: 400,
          headers: CORS_HEADERS,
        });
      }

      if (url.pathname === "/openapi.json") {
        return Response.json(
          buildOpenApiSpec(resolvePublicOrigin(req, allowedOrigins)),
          { headers: CORS_HEADERS },
        );
      }

      if (url.pathname === "/docs" || url.pathname === "/docs/") {
        return new Response(renderDocsHtml(), {
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "no-cache",
          },
        });
      }

      if (url.pathname.startsWith("/api/v1/")) {
        const action = actionFromHttpPath(url.pathname);
        if (!action) {
          return Response.json(
            { ok: false, error: "Unknown action" },
            { status: 404, headers: CORS_HEADERS },
          );
        }
        if (req.method !== "POST") {
          return Response.json(
            { ok: false, error: "Method Not Allowed; use POST" },
            { status: 405, headers: { ...CORS_HEADERS, Allow: "POST" } },
          );
        }
        return handleHttpAction(req, action);
      }

      if (url.pathname === "/health") {
        return Response.json(
          {
            ok: true,
            service: "templatenextjs-bun-ws",
            embeddedAssets: Object.keys(EMBEDDED_ASSETS).length,
            wsPath: "/ws",
            connectedClients: clients.size,
          },
          { headers: CORS_HEADERS },
        );
      }

      if (req.method === "GET" || req.method === "HEAD") {
        const staticRes = await tryServeStaticFrontend(
          url.pathname,
          staticDir,
          hasExplicitStaticDir,
        );
        if (staticRes) return staticRes;
      }

      return Response.json(
        {
          ok: false,
          error: "Not Found",
          endpoints: [
            "/health",
            "/docs",
            "/openapi.json",
            "/api/v1/{group}/{action}",
            "/ws",
          ],
        },
        { status: 404, headers: CORS_HEADERS },
      );
    },
    websocket: {
      open(ws) {
        clients.add(ws);
        const hello: WsBroadcastEvent = {
          type: "event",
          event: "state:init",
          data: { clientId: ws.data.clientId, authenticated: false },
          timestamp: new Date().toISOString(),
        };
        send(ws, hello);
      },
      async message(ws, raw) {
        let parsed: WsRequestMessage;
        try {
          parsed = JSON.parse(
            typeof raw === "string" ? raw : raw.toString("utf8"),
          ) as WsRequestMessage;
        } catch {
          send(ws, {
            id: "unknown",
            type: "response",
            ok: false,
            action: "state:init",
            error: "Invalid JSON message format",
          } satisfies WsResponseMessage);
          return;
        }

        const reqId = parsed.id || crypto.randomUUID();
        const action = parsed.action;
        const ctx: ActionContext = {
          sql: options?.sql,
          user: ws.data.user,
          sessionToken: ws.data.token,
          origin: ws.data.origin,
        };

        try {
          const res = await handleWsAction(ctx, action, parsed.payload || {});
          send(ws, {
            id: reqId,
            type: "response",
            ok: true,
            action,
            data: res.result,
          } satisfies WsResponseMessage);
          if (res.broadcast) {
            broadcastEvent(action, res.result);
          }
        } catch (err) {
          const errorMsg =
            err instanceof Error ? err.message : "Unexpected error";
          send(ws, {
            id: reqId,
            type: "response",
            ok: false,
            action,
            error: errorMsg,
          } satisfies WsResponseMessage);
        }
      },
      close(ws) {
        clients.delete(ws);
      },
    },
  });

  allowedOrigins = getAllowedOrigins(server.port);
  return server;
}

if (import.meta.main) {
  void (async () => {
    const srv = await startServer();
    console.log(
      `[bun-server] Listening on http://${srv.hostname}:${srv.port} (WebSocket path /ws, embeddedAssets=${Object.keys(EMBEDDED_ASSETS).length})`,
    );
  })();
}
