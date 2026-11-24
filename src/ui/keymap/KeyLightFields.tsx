// The fields under a chosen light in the Key Lighting tab: a colour and its
// effect, at a named speed or (Custom) with its timing in numbers; for a
// status light what it shows (a lock, the battery, a battery bar over several
// keys, a Bluetooth profile, USB, whether RGB effects are on, the lighting
// policy) and that one's own fields. Every colour is the same ColorChoice.

import { useState, type ReactNode } from "react";
import type { LightingEffect, LightingRgb8 } from "../../model/lighting-types";
import { SPEEDS, speedOf, speedTiming, type KeyLight, type Speed } from "../../model/lighting/key-light";
import { BATTERY_LEVELS, type Lock } from "../../model/lighting/status-light";
import { barFits } from "../../model/lighting/key-light";
import { BAR_STYLES, effectsStatusRules, policyStatusRules, STATUS_COLORS } from "../../model/lighting/status-presets";
import { effectColor } from "../lighting/decor";
import type { EffectKind } from "../../model/lighting/effect";
import { ColorChoice } from "../lighting/ColorChoice";
import { EffectTimingFields } from "../lighting/EffectEditor";
import { LED_PRESETS } from "../../model/lighting/color";
import { cx } from "../kit";
import type { KeyLights } from "./useKeyLights";

const [RED, , , GREEN] = LED_PRESETS;

const EFFECTS: Array<{ id: EffectKind; label: string }> = [
  { id: "Solid", label: "Steady" },
  { id: "Blink", label: "Blink" },
  { id: "Breathe", label: "Breathe" },
];
const SPEED_CHOICES: Array<{ id: Speed | "custom"; label: string }> = [
  { id: SPEEDS.fast, label: "Fast" },
  { id: SPEEDS.normal, label: "Normal" },
  { id: SPEEDS.slow, label: "Slow" },
  { id: "custom", label: "Custom" },
];
/** Whose battery a light shows: the firmware numbers the halves 0 (left) and 1 (right). */
const HALVES = [
  { id: 0, label: "Left half" },
  { id: 1, label: "Right half" },
];
type StatusKind = Exclude<KeyLight, { kind: "off" | "below" | "color" }>;
type Shows = Lock | "battery" | "bar" | "bluetooth" | "usb" | "effects" | "policy";
/** `needs`: what the keyboard (or, for a bar, the keys chosen) must have for it. */
const SHOWS: Array<{ id: Shows; label: string; needs?: "wireless" | "bar" | "effects" | "policy" }> = [
  { id: "caps_lock", label: "Caps Lock" },
  { id: "num_lock", label: "Num Lock" },
  { id: "scroll_lock", label: "Scroll Lock" },
  { id: "battery", label: "Battery" },
  { id: "bar", label: "Battery bar", needs: "bar" },
  { id: "bluetooth", label: "Bluetooth", needs: "wireless" },
  { id: "usb", label: "USB", needs: "wireless" },
  { id: "effects", label: "RGB effects", needs: "effects" },
  { id: "policy", label: "Lighting policy", needs: "policy" },
];
const showsOf = (light: StatusKind): Shows => (light.kind === "lock" ? light.lock : light.kind);

/** The status light that shows `shows`, keeping a lock light's colours from one lock to another. */
function showing(light: StatusKind, shows: Shows): StatusKind {
  if (shows === "battery") return { kind: "battery", level: 40, below: RED, above: GREEN };
  if (shows === "bar") return { kind: "bar", style: "bands" };
  if (shows === "bluetooth") return { kind: "bluetooth", profile: 0 };
  if (shows === "usb") return { kind: "usb" };
  if (shows === "effects") return { kind: "effects" };
  if (shows === "policy") return { kind: "policy" };
  return light.kind === "lock" ? { ...light, lock: shows } : { kind: "lock", lock: shows, on: RED, off: null };
}

const effectsOf = (rules: ReturnType<typeof effectsStatusRules>) => rules.map((rule) => rule.cell.effect);
const [EFFECTS_ON, EFFECTS_OFF] = effectsOf(effectsStatusRules(0, 0));
const [ALWAYS_ON, ALWAYS_OFF, POWERED_ONLY] = effectsOf(policyStatusRules(0, 0));

/** What a status light's colours mean: a Bluetooth profile's and USB's in the status preset's colours. */
const STATES: Record<"bluetooth" | "usb" | "effects" | "policy", Array<{ effect: LightingEffect; label: string }>> = {
  bluetooth: [
    { effect: STATUS_COLORS.empty, label: "Free" },
    { effect: STATUS_COLORS.bonded, label: "Paired" },
    { effect: STATUS_COLORS.advertising, label: "Pairing" },
    { effect: STATUS_COLORS.selected, label: "Chosen" },
    { effect: STATUS_COLORS.active, label: "In use" },
  ],
  usb: [
    { effect: STATUS_COLORS.bonded, label: "Unplugged" },
    { effect: STATUS_COLORS.selected, label: "Plugged in" },
    { effect: STATUS_COLORS.active, label: "In use" },
  ],
  effects: [
    { effect: EFFECTS_ON, label: "On" },
    { effect: EFFECTS_OFF, label: "Off" },
  ],
  policy: [
    { effect: ALWAYS_ON, label: "Always on" },
    { effect: ALWAYS_OFF, label: "Always off" },
    { effect: POWERED_ONLY, label: "On USB power" },
  ],
};

function States({ of }: { of: keyof typeof STATES }) {
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1">
      {STATES[of].map((state) => (
        <span key={state.label} className="flex items-center gap-1.5 text-small text-mute">
          <span className="size-2.5 rounded-sm border border-cap-edge" style={{ background: effectColor(state.effect) }} />
          {state.label}
        </span>
      ))}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-4">
      <span className="w-20 shrink-0 pt-0.5 text-body text-mute">{label}</span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

function Segments<T extends string | number>({ options, value, onPick }: {
  options: Array<{ id: T; label: string }>;
  value: T;
  onPick: (id: T) => void;
}) {
  return (
    <div className="inline-flex flex-wrap rounded-lg border border-line-strong p-0.5">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          aria-pressed={value === option.id}
          onClick={() => onPick(option.id)}
          className={cx(
            "cursor-pointer rounded-md px-3 py-1 text-body font-semibold transition-colors",
            value === option.id ? "bg-hover text-ink" : "text-mute hover:text-ink",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function KeyLightFields({ light, lights, keys, onChange, onTyping }: {
  light: KeyLight;
  lights: KeyLights;
  /** How many keys get the light: a battery bar is several. */
  keys: number;
  /** Gives the keys `light`; false, or a promise of false, when that was refused. */
  onChange: (light: KeyLight) => unknown;
  /** A timing number as it is typed, before it settles. */
  onTyping?: (light: KeyLight) => void;
}) {
  // Custom was picked, or a number typed, for these keys (the tab mounts the
  // fields afresh for each): the numbers stay open even while they match a named speed.
  const [numbers, setNumbers] = useState(false);
  const color = (value: LightingRgb8 | null, pick: (next: LightingRgb8 | null) => void, darkTitle?: string) => (
    <ColorChoice
      value={value}
      onPick={pick}
      darkTitle={darkTitle}
      used={lights.yours}
      usage={lights.usage}
      onRecolor={lights.recolor}
    />
  );

  if (light.kind === "color") {
    const animated = light.effect !== "Solid";
    const speed = speedOf(light.effect, light.timing);
    const custom = numbers || speed === null;
    return (
      <>
        <Field label="Color">{color(light.color, (next) => next && onChange({ ...light, color: next }))}</Field>
        <Field label="Effect">
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Segments options={EFFECTS} value={light.effect} onPick={(effect) => onChange({ ...light, effect })} />
              {animated && (
                <Segments
                  options={SPEED_CHOICES}
                  value={custom ? "custom" : speed}
                  onPick={(id) => {
                    setNumbers(id === "custom");
                    if (id !== "custom") onChange({ ...light, timing: speedTiming(id) });
                  }}
                />
              )}
            </div>
            {animated && custom && (
              <div className="flex max-w-52 flex-col gap-1.5">
                <EffectTimingFields
                  kind={light.effect}
                  timing={light.timing}
                  onTiming={(timing) => {
                    setNumbers(true);
                    return onChange({ ...light, timing });
                  }}
                  onTyping={(timing) => {
                    setNumbers(true);
                    onTyping?.({ ...light, timing });
                  }}
                />
              </div>
            )}
          </div>
        </Field>
      </>
    );
  }
  if (light.kind === "off" || light.kind === "below") return null;
  const offered = { wireless: lights.bleProfiles > 0, bar: barFits(keys), effects: lights.effectsLight, policy: lights.policyLight };
  const shows = SHOWS.filter((option) => !option.needs || offered[option.needs] || option.id === showsOf(light));
  return (
    <>
      <Field label="Shows">
        <Segments options={shows} value={showsOf(light)} onPick={(id) => onChange(showing(light, id))} />
      </Field>
      {light.kind === "lock" && (
        <>
          <Field label="When on">{color(light.on, (next) => next && onChange({ ...light, on: next }))}</Field>
          <Field label="When off">{color(light.off, (off) => onChange({ ...light, off }), "Dark while the lock is off")}</Field>
        </>
      )}
      {light.kind === "battery" && (
        <>
          {lights.split && (
            <Field label="Battery">
              <Segments options={HALVES} value={light.node ?? 0} onPick={(node) => onChange({ ...light, node })} />
            </Field>
          )}
          <Field label="Level">
            <Segments
              options={BATTERY_LEVELS.map((level) => ({ id: level as number, label: `${level}%` }))}
              value={light.level}
              onPick={(level) => onChange({ ...light, level })}
            />
          </Field>
          <Field label="Below">{color(light.below, (next) => next && onChange({ ...light, below: next }))}</Field>
          <Field label="Above">{color(light.above, (next) => next && onChange({ ...light, above: next }))}</Field>
        </>
      )}
      {light.kind === "bluetooth" && (
        <Field label="Profile">
          <div className="flex flex-col gap-2">
            <Segments
              options={Array.from({ length: Math.max(lights.bleProfiles, light.profile + 1) }, (_, slot) => ({ id: slot, label: String(slot + 1) }))}
              value={light.profile}
              onPick={(profile) => onChange({ ...light, profile })}
            />
            <States of="bluetooth" />
          </div>
        </Field>
      )}
      {light.kind === "bar" && (
        <>
          {lights.split && (
            <Field label="Battery">
              <Segments options={HALVES} value={light.node ?? 0} onPick={(node) => onChange({ ...light, node })} />
            </Field>
          )}
          <Field label="Colors">
            <Segments options={BAR_STYLES} value={light.style} onPick={(style) => onChange({ ...light, style })} />
          </Field>
        </>
      )}
      {(light.kind === "usb" || light.kind === "effects" || light.kind === "policy") && (
        <Field label="Colors">
          <States of={light.kind} />
        </Field>
      )}
    </>
  );
}
