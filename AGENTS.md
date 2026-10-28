<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Agent rules

This project is a bun server backend with a Next.js web UI.

1. For every code or configuration change, create an implementation note at
   `.implementation/<agent-name>/<implementation-name>.md`.
2. For every code or configuration change, create a roadmap note at
   `.roadmap/<agent-name>/<roadmap-name>.md`.
3. When adding or changing a function, add a focused test function for the new
   or changed behavior, especially for new API handlers and routing logic.
4. Run the relevant tests before reporting completion, and state clearly what
   was not physically or end-to-end validated.
5. Keep the Bun/Next.js contract aligned: document API paths, ports, proxy
   behavior, and any user-visible recovery or configuration requirements.
6. For the Android mobile client located at `/home/hylmi/Hylmi/Pemrograman_Berorientasi_Objek/C#/portalperumahan`,
   always execute builds and commands using `nix-shell --run "make build"` or `nix-shell --command "export PATH=\"$HOME/.dotnet:\$PATH\"; make <target>"`.
