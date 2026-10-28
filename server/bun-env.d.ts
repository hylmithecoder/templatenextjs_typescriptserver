export interface BunSqlClient {
  <T = Record<string, unknown>>(
    strings: TemplateStringsArray,
    ...values: unknown[]
  ): Promise<T[] & { count?: number }>;
  unsafe<T = Record<string, unknown>>(
    query: string,
    values?: unknown[],
  ): Promise<T[]>;
  begin<T>(fn: (tx: BunSqlClient) => Promise<T>): Promise<T>;
  close(): Promise<void>;
  end(): Promise<void>;
}

export interface BunServerWebSocket<T = unknown> {
  data: T;
  send(message: string | ArrayBuffer | Uint8Array, compress?: boolean): number;
  close(code?: number, reason?: string): void;
  subscribe(topic: string): void;
  unsubscribe(topic: string): void;
  publish(topic: string, message: string | ArrayBuffer | Uint8Array): number;
  isSubscribed(topic: string): boolean;
  readyState: number;
}

export interface BunServer<T = unknown> {
  port: number;
  hostname: string;
  stop(closeActiveConnections?: boolean): void;
  publish(
    topic: string,
    data: string | ArrayBufferView | ArrayBuffer,
    compress?: boolean,
  ): number;
  upgrade(req: Request, options?: { data?: T; headers?: HeadersInit }): boolean;
  requestIP?(req: Request): { address: string } | null;
}

export interface BunFile {
  exists(): Promise<boolean>;
  size: number;
  type: string;
  text(): Promise<string>;
  arrayBuffer(): Promise<ArrayBuffer>;
}

export interface BunSubprocess {
  pid: number;
  exited: Promise<number>;
  kill(signal?: number | NodeJS.Signals): void;
}

declare global {
  interface ImportMeta {
    main?: boolean;
  }

  namespace Bun {
    const SQL: {
      new (url: string | Record<string, unknown>): BunSqlClient;
    };
    const sql: BunSqlClient;
    function file(path: string): BunFile;
    function spawn(
      cmd: string[],
      options?: {
        cwd?: string;
        env?: Record<string, string | undefined>;
        stdout?: "inherit" | "pipe" | "ignore";
        stderr?: "inherit" | "pipe" | "ignore";
        stdin?: "inherit" | "pipe" | "ignore";
      },
    ): BunSubprocess;
    function serve<T = unknown>(options: {
      hostname?: string;
      port?: number;
      fetch(
        this: BunServer<T>,
        req: Request,
        server: BunServer<T>,
      ): Response | Promise<Response | undefined> | undefined;
      websocket?: {
        open?: (ws: BunServerWebSocket<T>) => void | Promise<void>;
        message: (
          ws: BunServerWebSocket<T>,
          message: string | Buffer,
        ) => void | Promise<void>;
        close?: (
          ws: BunServerWebSocket<T>,
          code: number,
          reason: string,
        ) => void | Promise<void>;
      };
    }): BunServer<T>;
    namespace password {
      function hash(password: string): Promise<string>;
      function verify(password: string, hash: string): Promise<boolean>;
    }
  }
}
