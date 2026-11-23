// The jq every Flow script gets in front of it (ADR 0027): names for what
// most Flows need, so a script reads `group("home_row")` and `set_keys(…)`
// instead of keeping its own tables of rows, columns and operation shapes.
// `$view` is the whole description (operations/describe.ts), so the helpers
// work anywhere in a script, whatever `.` is there. A script's own `def` with
// the same name and arity wins. Pure.

import { bindChoices, type FlowChoice } from "./choices";

export const FLOW_LIBRARY = String.raw`. as $view |
# The board: its named key groups (letters, home_row, thumbs, numbers, function, bottom),
# each a list of {row, col, hand, finger}.
def group($name): $view.board.groups[$name] // [];
def has_group($name): (group($name) | length) > 0;

# Layers, and the key a layer has at a spot of a group.
def layer($index): first($view.layers[] | select(.index == $index)) // null;
def base_layer: layer($view.default_layer);
def layer_named($name): first($view.layers[] | select(.name == $name)) // null;
def key_at($layer; $spot): $layer.keys[$spot.row][$spot.col];

# Tap-hold timing profiles, by name.
def profile_named($name): first($view.profiles[] | select(.name == $name)) // null;
def has_profile($name): profile_named($name) != null;

# Actions. mods(["left_shift"]) holds the modifiers named; a tap-hold may name
# its profile: tap_hold(key("A"); {Modifier: mods(["left_gui"])}; "HRM_pinky").
def mods($on): reduce ("left_ctrl", "left_shift", "left_alt", "left_gui", "right_ctrl", "right_shift", "right_alt", "right_gui") as $m
  ({}; .[$m] = (($on | index($m)) != null));
def key($hid): {Key: {Hid: $hid}};
def tap($hid): {Single: key($hid)};
def shifted($hid): {KeyWithModifier: [$hid, mods(["left_shift"])]};
def tap_hold($tap; $hold; $profile): {TapHold: [$tap, $hold, $profile]};

# What a key types on tap (a plain key, a tap-hold's tap), by HID name, or null.
def plain_hid: objects | .Key | objects | .Hid | strings;
def tapped_hid:
  (if type != "object" then null
   elif .Single then (.Single | plain_hid)
   elif .Tap then (.Tap | plain_hid)
   elif .TapHold then (.TapHold[0] | plain_hid)
   else null end) // null;
def is_tap_hold: type == "object" and (.TapHold | type) == "array";
def holds_modifier: is_tap_hold and ((.TapHold[1] | objects | .Modifier) // null) != null;
def is_letter: test("^[A-Z]$");
def is_digit: test("^Kc[0-9]$");
def is_punctuation: IN("Equal", "Minus", "Backslash", "Quote", "Grave", "Dot", "Comma", "Slash", "Semicolon", "LeftBracket", "RightBracket");

# Operations, as the script gives them back.
def set_keys($keys): {name: "set_keys", input: {keys: $keys}};
def set_timing_profile($name; $timing): {name: "set_timing_profile", input: {name: $name, timing: $timing}};
def add_layer($name; $after): {name: "add_layer", input: {name: $name, after: $after}};
def rename_layer($layer; $name): {name: "rename_layer", input: {layer: $layer, name: $name}};
`;

/** How many lines the library puts before a script: a script's line numbers start after them. */
export const FLOW_LIBRARY_LINES = FLOW_LIBRARY.split("\n").length - 1;

/** The program jq runs for a Flow: the library, the choices bound, the script. */
export function flowProgram(
  choices: readonly FlowChoice[],
  values: Readonly<Record<string, unknown>>,
  script: string,
): { program: string; lineOffset: number } {
  const bound = bindChoices(choices, values, script);
  return { program: FLOW_LIBRARY + bound.program, lineOffset: FLOW_LIBRARY_LINES + bound.lineOffset };
}
