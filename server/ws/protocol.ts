export type WsAction = "state:init" | "system:ping" | "system:echo";

export type WsEventName = WsAction | "presence" | "session:revoked";

export interface WsRequestMessage<T = Record<string, unknown>> {
  id?: string;
  action: WsAction;
  payload?: T;
}

export interface WsResponseMessage<T = unknown> {
  id: string;
  type: "response";
  ok: boolean;
  action: WsAction;
  data?: T;
  error?: string;
}

export interface WsBroadcastEvent<T = unknown> {
  type: "event";
  event: WsEventName;
  data: T;
  timestamp: string;
}
