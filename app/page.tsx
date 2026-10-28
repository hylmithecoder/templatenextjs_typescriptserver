"use client";

import { useEffect, useState } from "react";
import { resolveWsUrl } from "@/lib/ws-url";

interface HealthStatus {
  ok: boolean;
  service: string;
  embeddedAssets: number;
  wsPath: string;
  connectedClients: number;
}

export default function Home() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [wsState, setWsState] = useState<"connecting" | "connected" | "disconnected">("connecting");
  const [echoInput, setEchoInput] = useState("Hello from Next.js!");
  const [lastEcho, setLastEcho] = useState<string | null>(null);

  useEffect(() => {
    fetch("/health")
      .then((res) => res.json())
      .then((data: HealthStatus) => setHealth(data))
      .catch(() => setHealth(null));

    const ws = new WebSocket(resolveWsUrl(window.location));
    ws.onopen = () => {
      setWsState("connected");
      ws.send(JSON.stringify({ id: "ping-1", action: "system:ping", payload: {} }));
    };
    ws.onclose = () => setWsState("disconnected");
    ws.onerror = () => setWsState("disconnected");
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.action === "system:echo" && msg.ok && msg.data?.message) {
          setLastEcho(`${msg.data.message} (${msg.data.echoedAt})`);
        }
      } catch {
        // ignore malformed payload
      }
    };

    return () => {
      ws.close();
    };
  }, []);

  async function sendHttpEcho() {
    const res = await fetch("/api/v1/system/echo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: echoInput, broadcast: true }),
    });
    const json = await res.json();
    if (json.ok && json.data?.message) {
      setLastEcho(`${json.data.message} (${json.data.echoedAt})`);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 p-6 font-sans text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <main className="w-full max-w-2xl rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Next.js + Bun TypeScript Server Template
            </h1>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Unified HTTP gateway (<code className="font-mono">/api/v1/*</code>) &amp; realtime WebSocket (<code className="font-mono">/ws</code>)
            </p>
          </div>
          <span
            className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${
              wsState === "connected"
                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
            }`}
          >
            <span className="h-2 w-2 rounded-full bg-current" />
            WS: {wsState}
          </span>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
            <div className="text-xs font-medium uppercase text-zinc-400">Backend Health</div>
            <div className="mt-2 font-mono text-sm">
              {health ? `${health.service} (ok: ${String(health.ok)})` : "Unavailable (start bun server)"}
            </div>
          </div>
          <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
            <div className="text-xs font-medium uppercase text-zinc-400">API Documentation</div>
            <div className="mt-2 flex gap-4 text-sm font-medium">
              <a className="underline hover:text-zinc-600" href="/docs" target="_blank" rel="noreferrer">
                /docs (Scalar UI)
              </a>
              <a className="underline hover:text-zinc-600" href="/openapi.json" target="_blank" rel="noreferrer">
                /openapi.json
              </a>
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
          <label className="block text-xs font-medium uppercase text-zinc-400">
            Test Action Gateway (POST /api/v1/system/echo)
          </label>
          <div className="mt-2 flex gap-2">
            <input
              type="text"
              value={echoInput}
              onChange={(e) => setEchoInput(e.target.value)}
              className="flex-1 rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700"
            />
            <button
              type="button"
              onClick={sendHttpEcho}
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              Send
            </button>
          </div>
          {lastEcho && (
            <p className="mt-3 font-mono text-xs text-zinc-600 dark:text-zinc-400">
              Echo response: {lastEcho}
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
