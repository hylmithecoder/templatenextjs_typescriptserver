import type { BunSqlClient } from "../bun-env";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
}

export interface ActionContext {
  sql?: BunSqlClient;
  user: AuthUser | null;
  sessionToken: string | null;
  origin: string;
}

export interface ActionResult {
  result: unknown;
  broadcast?: boolean;
}

export class PermissionError extends Error {}
export class AuthRequiredError extends PermissionError {}

export function requireUser(ctx: ActionContext): AuthUser {
  if (!ctx.user) throw new AuthRequiredError("Authentication required");
  return ctx.user;
}

export function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim();
}
