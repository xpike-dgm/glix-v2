type Level = "info" | "warn" | "error";

function write(level: Level, msg: string, extra?: Record<string, unknown>): void {
  const line = JSON.stringify({ level, time: new Date().toISOString(), msg, ...extra });
  (level === "error" ? process.stderr : process.stdout).write(`${line}\n`);
}

export const log = {
  info: (msg: string, extra?: Record<string, unknown>) => write("info", msg, extra),
  warn: (msg: string, extra?: Record<string, unknown>) => write("warn", msg, extra),
  error: (msg: string, extra?: Record<string, unknown>) => write("error", msg, extra),
};
