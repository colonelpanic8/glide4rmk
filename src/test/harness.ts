// One workbench for core tests: a board (a simulated one, a layout file opened
// on its own offline board, or a session a test made itself), opened the way the
// app opens it (`openBundle`), with the real reducer and the real `io`, in
// Draft or in Live. A test names its board and its mode, and what it is about.

import { readFileSync } from "node:fs";
import "./wasm";
import { resolveCapabilities, firmwareFactsOf, type CapabilitySet } from "../capabilities";
import { mockProvider, type BoardSpec } from "../session/mock/board";
import type { OfflineBoardOptions } from "../session/offline/board";
import { openOfflineDocument } from "../session/offline/document";
import type { RynkSession } from "../session/types";
import type { ConnectedBundle, WorkbenchAction, WorkbenchState } from "../model/workbench-state";
import { initialWorkbenchState } from "../workbench/initial-state";
import { ioFeaturesFor, makeIo, type IoOptions, type WorkbenchIo } from "../workbench/io";
import { makeWorkbenchReducer } from "../workbench/reducer";
import { flowBoard, type FlowEnvironment } from "../workbench/flows";
import { openBundle } from "../workbench/open";
import { nodeJq } from "./jq";

/** The layout files tests open, each on the offline board it is for. */
export const FIXTURES = {
  /** TailorKey for RMK: the golden for round-trips and Flows. */
  tailorkey: "src/test/fixtures/glove80-tailorkey-qwerty.toml",
  /** Three layers, no home-row mods, no combos, no Magic layer. */
  plain: "src/test/fixtures/glove80-plain.toml",
  /** MoErgo's default Glove80 layout with its stock Magic layer's lights, the maintenance lock on Z (ADR 0035). */
  "glove80-magic": "src/test/fixtures/glove80-default-rgb.toml",
  /** MoErgo's default Go60 layout with its Magic layer's lights, as GLIDE4RMK saves it (a mod-tap without a profile on the base layer). */
  "go60-magic": "src/test/fixtures/go60-default-rgb.toml",
  /** MoErgo's Go60 factory layout, as MoErgo JSON: four layers. */
  go60: "src/test/fixtures/go60-factory-default.json",
} as const;

export type FixtureName = keyof typeof FIXTURES;

/** A layout file, opened on its own offline board with these surfaces. */
export interface TestFixture {
  fixture: FixtureName;
  board?: OfflineBoardOptions;
}

/** What a test opens: a simulated board, a fixture, or a session it made. */
export type TestBoard = BoardSpec | TestFixture | RynkSession;

export interface TestWorkbenchOptions {
  mode: "draft" | "live";
  /** Options for `makeIo` beyond the board's own; a function gets the bundle. */
  io?: Partial<IoOptions> | ((bundle: ConnectedBundle) => Partial<IoOptions>);
  /** What the connect-time read found, changed before the workbench opens. */
  connected?: (bundle: ConnectedBundle) => void;
}

export interface TestWorkbench {
  session: RynkSession;
  bundle: ConnectedBundle;
  io: WorkbenchIo;
  state: () => WorkbenchState;
  dispatch: (action: WorkbenchAction) => void;
  /** Every action dispatched, oldest first. */
  dispatched: WorkbenchAction[];
  /** Hears every dispatch, after the state changed (a mounted screen re-renders on it). */
  subscribe: (listener: () => void) => () => void;
  /** What the keyboard can do, as the screens ask it. */
  capabilities: CapabilitySet;
  /** A Flow environment for this board, asking its real capabilities. */
  flows: FlowEnvironment;
  close: () => Promise<void>;
}

export function fixtureText(name: FixtureName): string {
  return readFileSync(FIXTURES[name], "utf8");
}

const isSession = (board: TestBoard): board is RynkSession => "close" in board && "device" in board;
const isFixture = (board: TestBoard): board is TestFixture => "fixture" in board;

async function sessionOf(board: TestBoard): Promise<RynkSession> {
  if (isSession(board)) return board;
  if (isFixture(board)) {
    return openOfflineDocument(fixtureText(board.fixture), board.board).session;
  }
  return mockProvider(board).connect();
}

/** Opens `board` in a workbench; the caller closes it (or use `withTestWorkbench`). */
export async function openTestWorkbench(board: TestBoard, options: TestWorkbenchOptions): Promise<TestWorkbench> {
  const session = await sessionOf(board);
  try {
    const bundle = await openBundle(session);
    options.connected?.(bundle);
    let state: WorkbenchState = { ...initialWorkbenchState(bundle), batchMode: options.mode === "draft" };
    const reducer = makeWorkbenchReducer(bundle.caps.num_cols);
    const dispatched: WorkbenchAction[] = [];
    const listeners = new Set<() => void>();
    const subscribe = (listener: () => void) => {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    };
    const dispatch = (action: WorkbenchAction) => {
      state = reducer(state, action);
      dispatched.push(action);
      for (const listener of listeners) listener();
    };
    const extra = typeof options.io === "function" ? options.io(bundle) : options.io;
    const io = makeIo(session, () => state, dispatch, {
      cols: bundle.caps.num_cols, onDisconnect: () => {}, features: ioFeaturesFor(bundle), ...extra,
    });
    const capabilities = resolveCapabilities(firmwareFactsOf(bundle));
    const ids = capabilities.list().map(({ id }) => id as string);
    const flows: FlowEnvironment = { jq: nodeJq, board: flowBoard(bundle, ids), has: (id) => ids.includes(id) };
    return { session, bundle, io, state: () => state, dispatch, dispatched, subscribe, capabilities, flows, close: () => session.close() };
  } catch (error) {
    await session.close();
    throw error;
  }
}

/** Opens `board`, runs `check` on it and closes it, whatever `check` does. */
export async function withTestWorkbench(
  board: TestBoard,
  options: TestWorkbenchOptions,
  check: (bench: TestWorkbench) => Promise<void>,
): Promise<void> {
  const bench = await openTestWorkbench(board, options);
  try {
    await check(bench);
  } finally {
    await bench.close();
  }
}
