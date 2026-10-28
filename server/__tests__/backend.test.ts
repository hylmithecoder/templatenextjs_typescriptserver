import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { resolveWsUrl } from "../../lib/ws-url";
import type { BunServer } from "../bun-env";
import { buildConnectionUrl, getDatabaseConfig } from "../database/postgre";
import {
   getAllowedOrigins,
  resolvePublicOrigin,
  startServer,
  type WsClientData,
} from "../index";
import {
  actionFromHttpPath,
  httpPathForAction,
  renderDocsHtml,
} from "../openapi/docs";
import { buildOpenApiSpec } from "../openapi/spec";
import { getMimeType } from "../scripts/embed-static";

describe("Bun + Next.js template server", () => {
  let server: BunServer<WsClientData>;
  let baseUrl = "";

  beforeAll(async () => {
    server = await startServer({ hostname: "127.0.0.1", port: 0 });
    baseUrl = `http://127.0.0.1:${server.port}`;
  });

  afterAll(() => {
    server.stop(true);
  });

  test("routing helpers convert between WsAction and HTTP paths", () => {
    expect(httpPathForAction("system:ping")).toBe("/api/v1/system/ping");
    expect(httpPathForAction("system:echo")).toBe("/api/v1/system/echo");
    expect(actionFromHttpPath("/api/v1/system/ping")).toBe("system:ping");
    expect(actionFromHttpPath("/api/v1/system/echo/")).toBe("system:echo");
    expect(actionFromHttpPath("/api/v1/unknown/action")).toBeNull();
    expect(actionFromHttpPath("/other/path")).toBeNull();
  });

  test("origin helpers and ws-url resolver handle standard and override origins", () => {
    const allowed = getAllowedOrigins(5790);
    expect(allowed).toContain("http://localhost:3000");
    expect(allowed).toContain("http://127.0.0.1:5790");

    const req = new Request("http://127.0.0.1:5790/health", {
      headers: { origin: "http://localhost:3000" },
    });
    expect(resolvePublicOrigin(req, allowed)).toBe("http://localhost:3000");

    expect(
      resolveWsUrl({ protocol: "https:", host: "example.com", search: "" }),
    ).toBe("wss://example.com/ws");
    expect(
      resolveWsUrl({
        protocol: "http:",
        host: "localhost:3000",
        search: "?ws=ws://127.0.0.1:5790/ws",
      }),
    ).toBe("ws://127.0.0.1:5790/ws");
  });

  test("database and static embed helpers produce expected config and MIME types", () => {
    const cfg = getDatabaseConfig("custom_db");
    expect(cfg.database).toBe("custom_db");
    expect(buildConnectionUrl(cfg)).toContain("/custom_db");
    expect(getMimeType("index.html")).toBe("text/html; charset=utf-8");
    expect(getMimeType("bundle.js")).toBe("application/javascript; charset=utf-8");
  });

  test("GET /health, /openapi.json, and /docs return valid responses", async () => {
    const healthRes = await fetch(`${baseUrl}/health`);
    expect(healthRes.status).toBe(200);
    const health = (await healthRes.json()) as { ok: boolean; wsPath: string };
    expect(health.ok).toBe(true);
    expect(health.wsPath).toBe("/ws");

    const specRes = await fetch(`${baseUrl}/openapi.json`);
    expect(specRes.status).toBe(200);
    const spec = (await specRes.json()) as {
      openapi: string;
      paths: Record<string, unknown>;
    };
    expect(spec.openapi).toBe("3.1.0");
    expect(spec.paths["/api/v1/system/ping"]).toBeDefined();
    expect(buildOpenApiSpec(baseUrl).openapi).toBe("3.1.0");

    const docsRes = await fetch(`${baseUrl}/docs`);
    expect(docsRes.status).toBe(200);
    const html = await docsRes.text();
    expect(html).toContain("/openapi.json");
    expect(renderDocsHtml()).toContain("Scalar");
  });

  test("POST /api/v1/{group}/{action} executes handlers and validates payloads", async () => {
    const pingRes = await fetch(`${baseUrl}/api/v1/system/ping`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(pingRes.status).toBe(200);
    const pingJson = (await pingRes.json()) as {
      ok: boolean;
      action: string;
      data: { pong: boolean };
    };
    expect(pingJson.ok).toBe(true);
    expect(pingJson.action).toBe("system:ping");
    expect(pingJson.data.pong).toBe(true);

    const echoRes = await fetch(`${baseUrl}/api/v1/system/echo`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "hello template" }),
    });
    expect(echoRes.status).toBe(200);
    const echoJson = (await echoRes.json()) as {
      ok: boolean;
      data: { message: string };
    };
    expect(echoJson.ok).toBe(true);
    expect(echoJson.data.message).toBe("hello template");

    const badEchoRes = await fetch(`${baseUrl}/api/v1/system/echo`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "   " }),
    });
    expect(badEchoRes.status).toBe(400);

    const unknownRes = await fetch(`${baseUrl}/api/v1/system/nonexistent`, {
      method: "POST",
    });
    expect(unknownRes.status).toBe(404);
  });

  test("WebSocket /ws upgrades, sends state:init, and handles request/response", async () => {
    const wsUrl = baseUrl.replace(/^http/, "ws") + "/ws";
    const ws = new WebSocket(wsUrl);

    const messages: Record<string, unknown>[] = [];
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("WS timeout")), 5000);
      ws.onmessage = (event) => {
        const parsed = JSON.parse(String(event.data)) as Record<string, unknown>;
        messages.push(parsed);
        if (messages.length === 1) {
          ws.send(
            JSON.stringify({
              id: "req-1",
              action: "system:echo",
              payload: { message: "ws-hello" },
            }),
          );
        } else if (parsed.id === "req-1") {
          clearTimeout(timeout);
          resolve();
        }
      };
      ws.onerror = () => {
        clearTimeout(timeout);
        reject(new Error("WS error"));
      };
    });

    expect(messages[0]?.type).toBe("event");
    expect(messages[0]?.event).toBe("state:init");
    expect(messages[1]?.id).toBe("req-1");
    expect(messages[1]?.ok).toBe(true);
    expect((messages[1]?.data as { message: string })?.message).toBe("ws-hello");

    ws.close();
  });
});
