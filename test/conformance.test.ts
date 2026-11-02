/**
 * The satellite against the Nestor server's black-box conformance suite.
 *
 * The published server's `nestor satellites conformance`, run through uvx at the version in
 * `.nestor-version`, launches the built `my-satellite run` once per scenario, without a sound card:
 * pairing with a device code and an enrollment code, refused codes, rate limits, identify, acks,
 * text, audio both ways and reconnection. Run with `pnpm conformance`; raise `.nestor-version` to check
 * against a newer server.
 */

import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SERVER = `nestor-home[voice]==${readFileSync(join(ROOT, ".nestor-version"), "utf8").trim()}`;
const SATELLITE = ["node", join(ROOT, "dist/bin.js"), "run", "--core", "{url}", "--room", "salon"];

function conformance(command: string[]): Promise<{ code: number | null; output: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "uvx",
      ["--from", SERVER, "nestor", "satellites", "conformance", "--deadline", "20", "--", ...command],
      { cwd: ROOT, env: { ...process.env, LC_ALL: "en_US.UTF-8" } },
    );
    let output = "";
    child.stdout.on("data", (data: Buffer) => {
      output += data.toString();
    });
    child.stderr.on("data", (data: Buffer) => {
      output += data.toString();
    });
    child.on("error", reject);
    child.on("exit", (code) => resolve({ code, output }));
  });
}

it("passes the server's conformance suite", async () => {
  const { code, output } = await conformance([
    ...SATELLITE,
    "--input",
    "none",
    "--output",
    "none",
    "--token-file",
    "{state}/token.json",
  ]);
  expect(output).not.toMatch(/^FAIL/m);
  for (const check of [
    "PASS  receives the core's audio (A1, A2)",
    "PASS  sends its microphone audio (A1, A2)",
    "PASS  acknowledges intent.text within 1 s",
    "PASS  reconnects with the same token after the core closes its link (L5)",
    "PASS  pairs with the enrollment code of NESTOR_PAIRING_URI, no code typed (P3, P4)",
    "PASS  presents a refused enrollment code (used) only once (P5)",
    "PASS  keeps polling after a pending identify (I1)",
    "PASS  acknowledges intent.identify within 1 s",
  ]) {
    expect(output.split("\n"), `${check}: not run\n${output}`).toContain(check);
  }
  expect(output, output).toMatch(/^conformant: \d+ checks passed$/m);
  expect(code, output).toBe(0);
});
