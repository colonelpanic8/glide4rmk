import { describe, expect, it, vi } from "vitest";
import { mockProvider } from "../session/mock/board";
import { glove80Board } from "../session/mock/glove80";
import type { RynkSession } from "../session/types";
import type { KeyAction } from "../vendor/rynk-wasm/rynk_wasm";
import { openBundle } from "../ui/bundle";
import { readFlowFile, type Flow, type JqRunner } from "../operations/flows";
import { nodeJq } from "../test/jq";
import { initialWorkbenchState } from "./initial-state";
import { ioFeaturesFor, makeIo, type IoOptions, type WorkbenchIo } from "./io";
import { makeWorkbenchReducer } from "./reducer";
import type { WorkbenchState } from "../model/workbench-state";
import { draftOf } from "./draft/want";
import type { FlowEnvironment } from "./flows";

const letter = (code: string) => ({ Single: { Key: { Hid: code } } }) as KeyAction;

async function withBoard(
  draft: boolean,
  check: (session: RynkSession, io: WorkbenchIo, state: () => WorkbenchState) => Promise<void>,
  options: Partial<IoOptions> = {},
) {
  const session = await mockProvider(glove80Board).connect();
  try {
    const bundle = await openBundle(session);
    let state: WorkbenchState = { ...initialWorkbenchState(bundle), batchMode: draft };
    const reducer = makeWorkbenchReducer(bundle.caps.num_cols);
    const io = makeIo(session, () => state, (action) => { state = reducer(state, action); }, {
      cols: bundle.caps.num_cols, onDisconnect: () => {}, features: ioFeaturesFor(bundle), ...options,
    });
    await check(session, io, () => state);
  } finally {
    await session.close();
  }
}

/** A Flow whose script is `script`, with a `letter` choice. */
function flow(script: string, manifest = ""): Flow {
  const read = readFlowFile(
    `runs_on = "glide4rmk"\nuid = "test_flow"\ntitle = "Test flow"\nscript = '''\n${script}\n'''\n${manifest}\n[[param]]\nid = "letter"\nlabel = "Letter"\ntype = "select"\noptions = ["X", "Z"]\ndefault = "Z"\n`,
    "shared/test.flows",
  );
  if (!read.ok) throw new Error(read.message);
  return read.flow;
}

/** Sets the base layer's first key to the chosen letter, unless it is that already. */
const setFirstKey = flow(`
  .layers[0] as $base
  | {"Single": {"Key": {"Hid": $letter}}} as $want
  | if $base.keys[0][0] == $want
    then {operations: [], report: {changed: false, message: "The first key types \\($letter) already."}}
    else {operations: [{name: "set_keys", input: {keys: [{layer: $base.index, row: 0, col: 0, action: $want}]}}],
          report: {message: "The first key types \\($letter) now.", log: ["1 key"]}}
    end`);

const env = (overrides: Partial<FlowEnvironment> = {}): FlowEnvironment => ({
  jq: nodeJq,
  board: { id: "glove80", cols: 14 },
  has: () => true,
  ...overrides,
});

describe("running a Flow (ADR 0025)", () => {
  it("in Draft: its operations become one step that waits for Send, and Undo takes it back", async () => {
    const judge = vi.fn(async () => ({ ok: true as const }));
    await withBoard(true, async (session, io, state) => {
      const run = await io.runFlow(setFirstKey, { letter: "X" }, env());
      expect(run).toMatchObject({ ok: true, message: "The first key types X now.", log: { outcome: "done" } });
      expect(state().layers[0][0]).toEqual(letter("X"));
      expect((await session.keymap.readAll())[0].actions[0]).not.toEqual(letter("X"));
      expect(judge).toHaveBeenCalledTimes(1);
      expect(state().history.past).toHaveLength(1);
      expect(await io.travel("undo")).toEqual({ ok: true });
      expect(draftOf(state()).changes).toEqual([]);
    }, { judge });
  });

  it("in Live: the keyboard follows at once", async () => {
    await withBoard(false, async (session, io) => {
      expect(await io.runFlow(setFirstKey, {}, env())).toMatchObject({ ok: true, message: "The first key types Z now." });
      expect((await session.keymap.readAll())[0].actions[0]).toEqual(letter("Z"));
    });
  });

  it("changes nothing when Guard says no, or the Flow finds nothing to do", async () => {
    await withBoard(true, async (_session, io, state) => {
      const before = state().layers;
      const refused = await io.runFlow(setFirstKey, {}, env());
      expect(refused).toMatchObject({ ok: false, message: "kept as it was" });
      expect(state().layers).toBe(before);
    }, { judge: async () => ({ ok: false, message: "kept as it was", guarded: true }) });
    await withBoard(true, async (_session, io, state) => {
      await io.runFlow(setFirstKey, {}, env());
      const again = await io.runFlow(setFirstKey, {}, env());
      expect(again).toMatchObject({ ok: true, message: "The first key types Z already.", log: { outcome: "nothing to do" } });
      expect(state().history.past).toHaveLength(1);
    });
  });

  it("stops before running for another keyboard, a missing capability or a wrong choice", async () => {
    await withBoard(true, async (_session, io, state) => {
      const forGo60 = flow(".", '[manifest]\nkeyboards = ["go60"]');
      expect(await io.runFlow(forGo60, {}, env())).toMatchObject({ ok: false, message: "For the go60 only." });
      // A Flow that names no keyboard and requires nothing runs anywhere.
      expect(await io.runFlow(setFirstKey, {}, env({ has: () => false }))).toMatchObject({ ok: true });
      const needsMorse = flow(".", '[manifest]\nrequires = ["behaviors.morse"]');
      expect(await io.runFlow(needsMorse, {}, env({ has: () => false }))).toMatchObject({ ok: false, message: "Needs what this keyboard does not have: behaviors.morse." });
      expect(await io.runFlow(setFirstKey, { letter: "Q" }, env())).toMatchObject({ ok: false, message: 'The choice "Letter" has to be one of: X, Z. Nothing was changed.' });
      expect(state().history.past).toHaveLength(1);
    });
  });

  it("shows a Flow's own sentence as it is, and jq's complaints only in the log", async () => {
    await withBoard(true, async (_session, io, state) => {
      const stopped = await io.runFlow(flow('error("Your layout has no Gaming layer, so nothing was added.")'), {}, env());
      expect(stopped).toMatchObject({ ok: false, message: "Your layout has no Gaming layer, so nothing was added." });
      const broken = await io.runFlow(flow(".layers[0].keys[] | .x"), {}, env());
      expect(broken).toMatchObject({ ok: false, message: "Something went wrong while applying Test flow. Your layout is untouched.", log: { outcome: "error" } });
      expect(broken.log.lines.map(({ text }) => text)).toContain("jq: Cannot index array with string \"x\"");
      const typo = await io.runFlow(flow(".\n| )"), {}, env());
      expect(typo.message).toMatch(/^Line 2 of the script: syntax error/);
      expect(state().history.past).toEqual([]);
    });
  });

  it("changes nothing when a step fails, or when the layout changed while the script ran", async () => {
    await withBoard(true, async (_session, io, state) => {
      const badStep = flow('{operations: [{name: "set_keys", input: {keys: [{layer: 0, row: 0, col: 0, action: "No"}]}}, {name: "set_keys", input: {keys: [{layer: 99, row: 0, col: 0, action: "No"}]}}]}');
      expect(await io.runFlow(badStep, {}, env())).toMatchObject({
        ok: false,
        message: "Test flow was stopped, so nothing was changed: Step 2 (set_keys): Layer 99 does not exist. The automation may need fixing by its author.",
      });
      const meanwhile: JqRunner = {
        async run(input, program, options) {
          await io.apply("set_keys", { keys: [{ layer: 0, row: 1, col: 0, action: letter("Q") }] });
          return nodeJq.run(input, program, options);
        },
      };
      expect(await io.runFlow(setFirstKey, {}, env({ jq: meanwhile }))).toMatchObject({
        ok: false,
        message: "Your layout changed while Test flow ran, so nothing was changed. Run it again.",
      });
      expect(state().layers[0][0]).not.toEqual(letter("Z"));
      expect(state().history.past).toHaveLength(1);
    });
  });
});

