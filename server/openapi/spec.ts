import type { WsAction } from "../ws/protocol";
import { ACTION_DOCS, httpPathForAction } from "./docs";

export function buildOpenApiSpec(serverUrl: string) {
  const paths: Record<string, unknown> = {
    "/health": {
      get: {
        tags: ["System"],
        operationId: "health",
        summary: "Server health check",
        security: [],
        responses: {
          200: {
            description: "OK",
            content: { "application/json": { schema: { type: "object" } } },
          },
        },
      },
    },
    "/ws": {
      get: {
        tags: ["System"],
        operationId: "websocket",
        summary: "Realtime WebSocket endpoint (upgrade)",
        description:
          "Connect via `new WebSocket('ws://<host>/ws')`. Send `{ id, action, payload }` messages.",
        security: [],
        responses: { 101: { description: "Switching Protocols" } },
      },
    },
  };

  for (const [action, doc] of Object.entries(ACTION_DOCS) as [
    WsAction,
    (typeof ACTION_DOCS)[WsAction],
  ][]) {
    paths[httpPathForAction(action)] = {
      post: {
        operationId: action.replace(/[:]/g, "_"),
        tags: [doc.tag],
        summary: doc.summary,
        description: `${doc.description}\n\n**WebSocket:** \`{ "action": "${action}", "payload": { ... } }\``,
        security: doc.public ? [] : [{ bearerAuth: [] }],
        "x-websocket-action": action,
        requestBody: {
          required: Boolean(
            doc.body && (doc.body as { required?: string[] }).required?.length,
          ),
          content: {
            "application/json": {
              schema: doc.body ?? { type: "object" },
            },
          },
        },
        responses: {
          200: {
            description: "Success",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["ok", "action", "data"],
                  properties: {
                    ok: { const: true },
                    action: { const: action },
                    data: { type: "object" },
                  },
                },
              },
            },
          },
          400: { description: "Validation or handler error" },
          ...(doc.public
            ? {}
            : {
                401: { description: "Unauthorized" },
                403: { description: "Forbidden" },
              }),
        },
      },
    };
  }

  return {
    openapi: "3.1.0",
    info: {
      title: "Next.js + Bun TypeScript Server Template API",
      version: "0.1.0",
      description:
        "Unified HTTP (`/api/v1/{group}/{action}`) and WebSocket (`/ws`) backend powered by Bun.",
    },
    servers: [{ url: serverUrl, description: "Current server" }],
    paths,
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
        },
      },
    },
  };
}
