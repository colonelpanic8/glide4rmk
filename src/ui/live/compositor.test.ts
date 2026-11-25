// Live-view resolution: index-ordered binding fall-through and scene compositing.

import { describe, expect, it } from "vitest";
import type { KeyAction } from "../../model/action-types";
import type { DeviceReports } from "../../model/device-state";
import type {
  LightingConditionalSceneCell,
  LightingEffect,
  LightingOutputModeState,
  LightingSceneCell,
} from "../../model/lighting-types";
import type { RuntimeLightingRule } from "../../session/types";
import { compositeScenes, effectiveAction, type RuleTable } from "./compositor";

function solid(r: number): LightingEffect {
  return { Solid: { color: { r, g: 0, b: 0 } } };
}

function tap(code: string): KeyAction {
  return { Tap: { Key: code } } as unknown as KeyAction;
}

describe("effectiveAction", () => {
  // layers[layer][index]; index 0 across three layers.
  const layers: KeyAction[][] = [
    [tap("A")], // L0
    ["Transparent"], // L1
    ["Transparent"], // L2
  ];

  it("uses the effective layer's own binding when it is concrete", () => {
    const l = [[tap("A")], [tap("B")]];
    expect(effectiveAction(l, [0, 1], 0, 0)).toEqual(tap("B"));
  });

  it("falls through Transparent downward toward the default floor", () => {
    // Effective L2 transparent → L1 transparent → floor L0 concrete.
    expect(effectiveAction(layers, [0, 2], 0, 0)).toEqual(tap("A"));
  });

  it("consults an active intermediate layer", () => {
    const l: KeyAction[][] = [[tap("A")], [tap("B")], ["Transparent"]];
    expect(effectiveAction(l, [0, 1, 2], 0, 0)).toEqual(tap("B"));
  });

  it("consults an explicitly active layer below the default", () => {
    expect(effectiveAction(layers, [0, 1, 2], 1, 0)).toEqual(tap("A"));
  });
});

describe("compositeScenes", () => {
  const scenes: LightingSceneCell[] = [
    { layer: 0, led_id: 1, effect: solid(10) }, // default/floor
    { layer: 2, led_id: 1, effect: solid(20) }, // effective
    { layer: 2, led_id: 3, effect: solid(30) },
  ];

  it("EffectiveOnly composites only the effective layer (+ overlay)", () => {
    const out = compositeScenes([], scenes, {}, [0, 2], 0, null, "EffectiveOnly");
    expect(out.get(1)).toEqual({ effect: solid(20), source: "runtime-effective" });
    expect(out.get(3)).toEqual({ effect: solid(30), source: "runtime-effective" });
    expect(out.size).toBe(2);
  });

  it("ActiveStack adds the default floor beneath the effective layer", () => {
    const out = compositeScenes([], scenes, {}, [0, 2], 0, null, "ActiveStack");
    // led 1 present on both layers → effective wins.
    expect(out.get(1)).toEqual({ effect: solid(20), source: "runtime-effective" });
    expect(out.get(3)).toEqual({ effect: solid(30), source: "runtime-effective" });
  });

  it("ActiveStack keeps a floor-only cell when the effective layer lacks it", () => {
    const floorOnly: LightingSceneCell[] = [{ layer: 0, led_id: 9, effect: solid(10) }];
    const out = compositeScenes([], floorOnly, {}, [0, 2], 0, null, "ActiveStack");
    expect(out.get(9)).toEqual({ effect: solid(10), source: "runtime-default" });
  });

  it("runtime cells override compiled defaults while policies stay independent", () => {
    const compiled: LightingSceneCell[] = [
      { layer: 0, led_id: 1, effect: solid(5) },
      { layer: 2, led_id: 2, effect: solid(6) },
    ];
    const runtime: LightingSceneCell[] = [{ layer: 2, led_id: 1, effect: solid(50) }];
    const out = compositeScenes(compiled, runtime, {}, [0, 2], 0, "ActiveStack", "EffectiveOnly");
    expect(out.get(1)).toEqual({ effect: solid(50), source: "runtime-effective" });
    expect(out.get(2)).toEqual({ effect: solid(6), source: "compiled-effective" });
  });

  it("overlay sits on top of everything", () => {
    const out = compositeScenes(
      [],
      scenes,
      { 1: { led_id: 1, effect: solid(99), ttl_ms: undefined } },
      [0, 2],
      0,
      null,
      "ActiveStack",
    );
    expect(out.get(1)).toEqual({ effect: solid(99), source: "overlay" });
  });

  it("applies matching conditional status after the host overlay", () => {
    const conditional: LightingConditionalSceneCell[] = [
      {
        conditions: {
          layer: { layer: 2, active: true },
          battery: { node: 1, min_level: 20, max_level: 40, charge: "Discharging" },
          output_mode: undefined,
        },
        led_id: 1,
        effect: solid(77),
      },
    ];
    const out = compositeScenes(
      [],
      scenes,
      { 1: { led_id: 1, effect: solid(99), ttl_ms: undefined } },
      [0, 2],
      0,
      null,
      "ActiveStack",
      conditional,
      new Map([[1, { Available: { charge_state: "Discharging", level: 30 } }]]),
    );
    expect(out.get(1)).toEqual({ effect: solid(77), source: "conditional" });
  });

  it("applies the wake-layer output indicator after conditional status", () => {
    const outputMode: LightingOutputModeState = {
      mode: "PoweredOnly",
      powered: false,
      wake_active: true,
      effective_enabled: true,
      powered_only_scope: "Local",
      cycle_user_action: 13,
      wake_layers: 1 << 2,
      indicator: {
        led_id: 1,
        always_on: solid(1),
        always_off: solid(2),
        powered_only: solid(3),
      },
    };
    const conditional: LightingConditionalSceneCell[] = [
      {
        conditions: {
          layer: { layer: 2, active: true },
          battery: undefined,
          output_mode: undefined,
        },
        led_id: 1,
        effect: solid(77),
      },
    ];
    const out = compositeScenes(
      [],
      [],
      {},
      [0, 2],
      0,
      null,
      null,
      conditional,
      new Map(),
      outputMode,
    );
    expect(out.get(1)).toEqual({ effect: solid(3), source: "output-mode" });
  });

  it("ActiveStack composites every active layer in index order", () => {
    const all: LightingSceneCell[] = [
      { layer: 0, led_id: 1, effect: solid(10) },
      { layer: 1, led_id: 1, effect: solid(20) },
      { layer: 2, led_id: 2, effect: solid(30) },
    ];
    const out = compositeScenes([], all, {}, [0, 1, 2], 0, null, "ActiveStack");
    expect(out.get(1)).toEqual({ effect: solid(20), source: "runtime-active" });
    expect(out.get(2)).toEqual({ effect: solid(30), source: "runtime-effective" });
  });

  it("mirrors the reported blue -> red -> cyan active stack", () => {
    const blue: LightingEffect = { Solid: { color: { r: 0, g: 0, b: 255 } } };
    const red: LightingEffect = { Solid: { color: { r: 255, g: 0, b: 0 } } };
    const cyan: LightingEffect = { Solid: { color: { r: 0, g: 255, b: 255 } } };
    const compiled: LightingSceneCell[] = [
      { layer: 0, led_id: 1, effect: blue },
      { layer: 3, led_id: 1, effect: red },
      { layer: 4, led_id: 1, effect: cyan },
    ];

    const layer4 = compositeScenes(compiled, [], {}, [0, 3, 4], 0, "ActiveStack", null);
    expect(layer4.get(1)).toEqual({ effect: cyan, source: "compiled-effective" });

    const layer3 = compositeScenes(compiled, [], {}, [0, 3], 0, "ActiveStack", null);
    expect(layer3.get(1)).toEqual({ effect: red, source: "compiled-effective" });
  });

  it("applies a non-zero default before lower active lighting layers", () => {
    const all: LightingSceneCell[] = [
      { layer: 0, led_id: 1, effect: solid(10) },
      { layer: 1, led_id: 1, effect: solid(20) },
    ];
    const out = compositeScenes([], all, {}, [0, 1], 1, null, "ActiveStack");
    expect(out.get(1)).toEqual({ effect: solid(10), source: "runtime-active" });
  });
});

describe("compositeScenes: the keyboard's own condition rules", () => {
  const rule = (led: number, r: number, extra: Partial<RuntimeLightingRule> = {}): RuntimeLightingRule => ({
    cell: { conditions: { layer: undefined, battery: undefined, output_mode: undefined }, led_id: led, effect: solid(r) },
    connection: undefined,
    effects: undefined,
    layers: undefined,
    indicators: undefined,
    ...extra,
  });
  const table = (rules: RuntimeLightingRule[], reports: Partial<RuleTable> = {}): RuleTable => ({
    rules, connection: null, indicators: null, effectsEnabled: null, ...reports,
  });
  const usb: NonNullable<DeviceReports["connection"]> = { usb: "Configured", ble: [{ state: "Advertising", bonded: false }], selected: 0, preferred: "Usb" };
  const compiledOnLed1: LightingConditionalSceneCell = { conditions: { layer: undefined, battery: undefined, output_mode: undefined }, led_id: 1, effect: solid(10) };
  const composite = (rules: RuleTable | null) => compositeScenes([], [], {}, [0], 0, null, null, [compiledOnLed1], new Map(), null, rules);

  it("lights an editable rule that matches, after the compiled ones, as the firmware composes them", () => {
    const out = composite(table([rule(1, 20), rule(2, 30)]));
    expect(out.get(1)).toEqual({ effect: solid(20), source: "rule" });
    expect(out.get(2)).toEqual({ effect: solid(30), source: "rule" });
  });

  it("tests the connection and the lock lights the keyboard reports", () => {
    const onUsb = rule(2, 30, { connection: { transport: "Usb", profile: undefined, ble_state: undefined, usb_connected: undefined, bonded: undefined } });
    const capsOn = rule(3, 40, { indicators: { num_lock: undefined, caps_lock: true, scroll_lock: undefined } });
    const caps = { num_lock: false, caps_lock: true, scroll_lock: false, compose: false, kana: false };
    const out = composite(table([onUsb, capsOn], { connection: usb, indicators: caps }));
    expect(out.get(2)?.source).toBe("rule");
    expect(out.get(3)?.source).toBe("rule");
    const unknown = composite(table([onUsb, capsOn]));
    expect(unknown.has(2)).toBe(false);
    expect(unknown.has(3)).toBe(false);
  });

  it("leaves a rule on something the host cannot see unlit: maintenance, the split link", () => {
    const out = composite(table([rule(2, 30, { maintenance: { unlocked: true } }), rule(3, 40, { split_transport: { link: "Wired", force: undefined } })]));
    expect(out.has(2)).toBe(false);
    expect(out.has(3)).toBe(false);
  });

  it("shows only the compiled rules without the table, as before", () => {
    expect([...composite(null)]).toEqual([[1, { effect: solid(10), source: "conditional" }]]);
  });
});
