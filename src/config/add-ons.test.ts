import { describe, expect, it } from "vitest";
import { modulesFromFile, withModules } from "./add-ons";

const TOML = 'default_layer = 0\n\n[[layer]]\nid = "layer0"\n';
const JSON_FILE = '{\n  "keyboard": "glove80",\n  "layout_parameters": {}\n}\n';

describe("add-on modules in a layout file", () => {
  it("live in a TOML file as a comment line before its first table, which round-trips", () => {
    const written = withModules(TOML, "toml", ["lh-cirque", "rh-cirque"]);
    expect(written.split("\n")[0]).toBe('# hardware_modules = "lh-cirque,rh-cirque"');
    expect(modulesFromFile(written, "toml")).toEqual(["lh-cirque", "rh-cirque"]);
    expect(withModules(written, "toml", ["rh-cirque"]).match(/hardware_modules/g)).toHaveLength(1);
    expect(withModules(written, "toml", [])).toBe(TOML);
  });

  it("are not read from a comment further down a TOML file", () => {
    expect(modulesFromFile(`${TOML}# hardware_modules = "lh-cirque"\n`, "toml")).toEqual([]);
  });

  it("live in MoErgo JSON where GLIDE and MoErgo keep them, keeping the file's other parameters and indent", () => {
    const written = withModules(JSON_FILE, "moergo-json", ["rh-cirque"]);
    expect(JSON.parse(written).layout_parameters).toEqual({ hardware_modules: "rh-cirque" });
    expect(written.split("\n")[1]).toBe('  "keyboard": "glove80",');
    expect(modulesFromFile(written, "moergo-json")).toEqual(["rh-cirque"]);
    expect(JSON.parse(withModules(written, "moergo-json", [])).layout_parameters).toEqual({});
    expect(modulesFromFile("not json", "moergo-json")).toEqual([]);
  });
});
