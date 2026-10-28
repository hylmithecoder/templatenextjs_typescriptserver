import type { ActionContext, ActionResult } from "./context";
import { requireUser, str } from "./context";
import type { WsAction } from "./protocol";

export type Handler = (
  ctx: ActionContext,
  payload: Record<string, unknown>,
) => Promise<ActionResult>;

/** Actions that an unauthenticated client may invoke over WebSocket or HTTP. */
export const PUBLIC_ACTIONS: ReadonlySet<WsAction> = new Set<WsAction>([
  "state:init",
  "system:ping",
  "system:echo",
]);

export const ACTION_HANDLERS: Record<WsAction, Handler> = {
  "state:init": async (ctx) => ({
    result: {
      authenticated: Boolean(ctx.user),
      user: ctx.user,
      serverTime: new Date().toISOString(),
    },
  }),
  "system:ping": async () => ({
    result: {
      pong: true,
      timestamp: new Date().toISOString(),
    },
  }),
  "system:echo": async (_ctx, payload) => {
    const message = str(payload.message);
    if (!message) {
      throw new Error("Field 'message' is required");
    }
    return {
      result: {
        message,
        echoedAt: new Date().toISOString(),
      },
      broadcast: Boolean(payload.broadcast),
    };
  },
};

export async function handleWsAction(
  ctx: ActionContext,
  action: WsAction,
  payload: Record<string, unknown> = {},
): Promise<ActionResult> {
  const handler = ACTION_HANDLERS[action];
  if (!handler) {
    throw new Error(`Unknown WebSocket action: ${String(action)}`);
  }
  if (!PUBLIC_ACTIONS.has(action)) {
    requireUser(ctx);
  }
  return handler(ctx, payload);
}
