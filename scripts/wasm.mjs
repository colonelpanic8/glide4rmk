// Puts the WASM clients in src/vendor/, built by Nix from the flake: `npm run wasm`,
// and before `npm run dev`, `npm run build` and `npm test`.
// Skips Nix when src/vendor/ already holds clients built from this flake (its
// WASM_KEY matches scripts/wasm-key.mjs), as after scripts/setup-session.sh or
// in CI. Without Nix it uses what src/vendor/ has, and says so when that is stale.
//   node scripts/wasm.mjs [--force]    --force: build with Nix even when they match
import { spawnSync } from "node:child_process";
import { existsSync, lstatSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { wasmKey } from "./wasm-key.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const VENDOR = path.join(ROOT, "src/vendor");
const STAMP = path.join(VENDOR, "WASM_KEY");
const CLIENTS = ["rynk-wasm", "moergo-config-wasm"];

const key = wasmKey();
const present = CLIENTS.every((name) => existsSync(path.join(VENDOR, name)));
const built = existsSync(STAMP) ? readFileSync(STAMP, "utf8").trim() : "";

if (present && built === key && !process.argv.includes("--force")) {
  console.log(`WASM clients match this flake (${key.slice(0, 12)}); Nix not needed.`);
  process.exit(0);
}

const hasNix = spawnSync("nix", ["--version"], { stdio: "ignore" }).status === 0;
if (!hasNix) {
  if (!present) {
    console.error("No WASM clients in src/vendor/ and no Nix to build them: run scripts/setup-session.sh.");
    process.exit(1);
  }
  console.warn(
    built
      ? `Warning: the WASM clients in src/vendor/ were built from another flake (${built.slice(0, 12)}, this one is ${key.slice(0, 12)}); without Nix they are used as they are.`
      : "Warning: the WASM clients in src/vendor/ have no WASM_KEY, so whether they match this flake is unknown; without Nix they are used as they are.",
  );
  process.exit(0);
}

mkdirSync(VENDOR, { recursive: true });
for (const name of CLIENTS) {
  const link = path.join(VENDOR, name);
  // A copied directory (from setup-session.sh) would stop Nix placing its link.
  if (existsSync(link) && !lstatSync(link).isSymbolicLink()) rmSync(link, { recursive: true, force: true });
  const run = spawnSync("nix", ["build", `.#${name}`, "--out-link", link], { cwd: ROOT, stdio: "inherit" });
  if (run.status !== 0) process.exit(run.status ?? 1);
}
writeFileSync(STAMP, `${key}\n`);
