export {};

const backendProc = Bun.spawn(["bun", "--watch", "run", "server/index.ts"], {
  stdout: "inherit",
  stderr: "inherit",
  stdin: "inherit",
});

const frontendProc = Bun.spawn(["bun", "run", "next", "dev"], {
  stdout: "inherit",
  stderr: "inherit",
  stdin: "inherit",
});

let shuttingDown = false;

function shutdown(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  try {
    backendProc.kill("SIGTERM");
  } catch {
    // ignore
  }
  try {
    frontendProc.kill("SIGTERM");
  } catch {
    // ignore
  }
  process.exit(exitCode);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

console.log(
  "[dev] Starting Bun Server (:5790) and Next.js Frontend (:3000) concurrently...",
);

const firstExitCode = await Promise.race([
  backendProc.exited,
  frontendProc.exited,
]);

shutdown(firstExitCode);
