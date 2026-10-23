import { spawnSync } from "node:child_process";

/** Runs one of the PyMuPDF helpers in scripts/ with the project's venv; returns stdout. */
export function runPython(script: string, args: string[]): string {
  const r = spawnSync(".venv/bin/python", ["-I", `scripts/${script}`, ...args], { encoding: "utf8" });
  if (r.status !== 0) throw new Error(`${script} ${args.join(" ")}: ${r.stderr}`);
  return r.stdout;
}
