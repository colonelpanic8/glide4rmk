// The WASM key: one hash of everything the WASM clients are built from
// (flake.nix, flake.lock and nix/). CI caches the clients under it and writes it
// beside them as WASM_KEY (in src/vendor/ and on the ci/vendor-wasm-out branch),
// so a checkout can tell whether the clients it has match its own flake.
//   node scripts/wasm-key.mjs          prints the key of this checkout
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

function files(dir) {
  return readdirSync(path.join(ROOT, dir)).flatMap((name) => {
    const rel = `${dir}/${name}`;
    return statSync(path.join(ROOT, rel)).isDirectory() ? files(rel) : [rel];
  });
}

/** The hash of flake.nix, flake.lock and every file under nix/, by path and content. */
export function wasmKey() {
  const inputs = ["flake.nix", "flake.lock", ...(existsSync(path.join(ROOT, "nix")) ? files("nix") : [])].sort();
  const hash = createHash("sha256");
  for (const rel of inputs) {
    const content = createHash("sha256").update(readFileSync(path.join(ROOT, rel))).digest("hex");
    hash.update(`${rel}\n${content}\n`);
  }
  return hash.digest("hex");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(wasmKey());
}
