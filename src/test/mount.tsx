// Screen tests that click (ADR 0030). `mountWorkbench` mounts a screen in a
// real DOM (happy-dom, asked for per test file with a
// `// @vitest-environment happy-dom` comment) inside a workbench opened by the
// core harness (harness.ts): a simulated board or a layout file, the real
// reducer, the real `io` behind Guard, and the one history, as the app's
// Workbench wires them. The helpers press, click, type keys and drag the way a
// browser delivers those events, and wait for what the board answers.
// Static screens keep `renderInWorkbench` (workbench.tsx).

import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach } from "vitest";
import type { WorkbenchAction, WorkbenchState } from "../model/workbench-state";
import type { BoardSpec } from "../session/mock/board";
import type { RynkSession } from "../session/types";
import { ledNodesOf, type WorkbenchIo } from "../workbench";
import { guardIo, guardJudge } from "../ui/guard/guardIo";
import { MountHost } from "./mount-host";
import { openTestWorkbench, type TestFixture, type TestWorkbench, type TestWorkbenchOptions } from "./harness";

// React runs effects and state updates inside act() only when told it is under test.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** What to mount on: a simulated board (or a session), or a layout file; and the mode. */
export type MountOptions = Omit<TestWorkbenchOptions, "io"> & ({ board: BoardSpec | RynkSession } | TestFixture);

/** Modifier keys held during a press, a click or a key. */
export interface Held {
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
  alt?: boolean;
}

export interface Mounted {
  /** The opened workbench: its session, bundle, io (behind Guard) and state. */
  bench: TestWorkbench & { io: WorkbenchIo };
  state: () => WorkbenchState;
  /** The page; windows opened in a portal are in it too. */
  page: HTMLElement;
  /** A key on the canvas by its place, e.g. `canvasKey(3, 2)`. */
  canvasKey: (row: number, col: number) => Element;
  /** The button whose text or label contains `name` (the first, or the one `nth`). */
  button: (name: string | RegExp, nth?: number) => HTMLElement;
  /** Whether some text is on the page. */
  shows: (text: string | RegExp) => boolean;
  /** A primary click: pointer down and up, then click, with these keys held. */
  click: (target: Element, held?: Held) => Promise<void>;
  /** A key pressed on `target` (default: the focused element, else the page). */
  key: (key: string, held?: Held, target?: Element) => Promise<void>;
  /** A drag with the primary button from one element to another. With
   *  `crossing` the pointer passes over those elements on its way. */
  drag: (from: Element, to: Element, options?: Held & { crossing?: Element[] }) => Promise<void>;
  /** A screen-state action, as a screen would dispatch it (the layer shown, a selection). */
  dispatch: (action: WorkbenchAction) => Promise<void>;
  /** Runs `step` as the page would (opening a window from its store, say), then lets it settle. */
  run: (step: () => void) => Promise<void>;
  /** Waits until `check` holds (the board answers asynchronously), up to `ms` of real time. */
  until: (check: () => boolean, what?: string, ms?: number) => Promise<void>;
  /** Lets `ms` of real time pass, with React's updates and the board's answers. */
  wait: (ms: number) => Promise<void>;
  /** Unmounts the screen (its effects' cleanup runs) and closes the board. */
  unmount: () => Promise<void>;
}

/** Whether a control is greyed out: disabled, or (with a reason, `<Button disabled reason>`) aria-disabled. */
export function isDisabled(control: Element): boolean {
  return control.hasAttribute("disabled") || control.getAttribute("aria-disabled") === "true";
}

const mounted = new Set<Mounted>();
afterEach(async () => {
  for (const one of [...mounted]) await one.unmount();
});

const modifiers = (held: Held = {}) => ({
  ctrlKey: held.ctrl ?? false,
  metaKey: held.meta ?? false,
  shiftKey: held.shift ?? false,
  altKey: held.alt ?? false,
});

function pointer(type: string, init: PointerEventInit): PointerEvent {
  return new PointerEvent(type, { bubbles: type !== "pointerenter" && type !== "pointerleave", cancelable: true, composed: true, pointerId: 1, pointerType: "mouse", isPrimary: true, ...init });
}

/** Lets pending promises (the board's answers) and React's updates run. */
async function settle(): Promise<void> {
  await act(async () => {
    for (let i = 0; i < 5; i++) await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

/** Mounts any tree in a fresh element on the page; for a screen use `mountWorkbench`. */
export function mount(node: ReactNode): { page: HTMLElement; root: Root; unmount: () => void } {
  const page = document.createElement("div");
  document.body.appendChild(page);
  const root = createRoot(page);
  act(() => root.render(node));
  return {
    page,
    root,
    unmount: () => {
      act(() => root.unmount());
      page.remove();
    },
  };
}

/** Mounts `node` in a workbench on `options.board` (or `options.fixture`), in `options.mode`. */
export async function mountWorkbench(node: ReactNode, options: MountOptions): Promise<Mounted> {
  const board = "fixture" in options ? { fixture: options.fixture, board: options.board } : options.board;
  const bench = await openTestWorkbench(board, {
    mode: options.mode,
    connected: options.connected,
    io: (bundle) => ({ judge: guardJudge(bundle), ledNodes: ledNodesOf(bundle) }),
  });
  const io = guardIo(bench.io, bench.bundle, bench.state);
  const tree = mount(
    <MountHost bench={bench} io={io}>
      {node}
    </MountHost>,
  );
  await settle();

  const all = (selector: string) => [...document.body.querySelectorAll<HTMLElement>(selector)];
  const matches = (text: string, name: string | RegExp) => (typeof name === "string" ? text.includes(name) : name.test(text));

  let closed = false;
  const mountedOne: Mounted = {
    bench: { ...bench, io },
    state: bench.state,
    page: document.body,
    canvasKey(row, col) {
      const key = tree.page.querySelector(`[data-key="${row},${col}"]`) ?? document.body.querySelector(`[data-key="${row},${col}"]`);
      if (!key) throw new Error(`No key at row ${row}, column ${col} on the canvas`);
      return key;
    },
    button(name, nth = 0) {
      const found = all("button, [role=button]").filter((one) => matches(`${one.textContent ?? ""} ${one.getAttribute("aria-label") ?? ""}`, name));
      if (!found[nth]) throw new Error(`No button "${String(name)}" on the page`);
      return found[nth];
    },
    shows: (text) => matches(document.body.textContent ?? "", text),
    async click(target, held) {
      const at = { clientX: 1, clientY: 1, ...modifiers(held) };
      act(() => {
        target.dispatchEvent(pointer("pointerdown", { ...at, button: 0, buttons: 1 }));
        target.dispatchEvent(pointer("pointerup", { ...at, button: 0, buttons: 0 }));
        target.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, ...at, button: 0 }));
      });
      await settle();
    },
    async key(key, held, target) {
      const on = target ?? (document.activeElement instanceof Element ? document.activeElement : document.body);
      act(() => {
        on.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...modifiers(held) }));
        on.dispatchEvent(new KeyboardEvent("keyup", { key, bubbles: true, cancelable: true, ...modifiers(held) }));
      });
      await settle();
    },
    async drag(from, to, options = {}) {
      const held = modifiers(options);
      // No layout here: the canvas asks what is under the pointer, so the drag answers it.
      let under: Element = from;
      const original = document.elementFromPoint;
      document.elementFromPoint = () => under;
      try {
        let x = 1;
        const move = (onto: Element) => {
          const leaving = under;
          under = onto;
          x += 20;
          if (leaving !== onto) {
            leaving.dispatchEvent(pointer("pointerout", { clientX: x, clientY: 1, buttons: 1, relatedTarget: onto, ...held }));
            onto.dispatchEvent(pointer("pointerover", { clientX: x, clientY: 1, buttons: 1, relatedTarget: leaving, ...held }));
          }
          onto.dispatchEvent(pointer("pointermove", { clientX: x, clientY: 1, buttons: 1, ...held }));
        };
        act(() => {
          from.dispatchEvent(pointer("pointerdown", { clientX: x, clientY: 1, button: 0, buttons: 1, ...held }));
        });
        for (const onto of [...(options.crossing ?? []), to]) act(() => move(onto));
        act(() => {
          to.dispatchEvent(pointer("pointerup", { clientX: x, clientY: 1, button: 0, buttons: 0, ...held }));
        });
        await settle();
      } finally {
        document.elementFromPoint = original;
      }
    },
    async dispatch(action) {
      await mountedOne.run(() => bench.dispatch(action));
    },
    async run(step) {
      act(step);
      await settle();
    },
    async until(check, what = "the condition", ms = 3000) {
      const deadline = Date.now() + ms;
      while (!check()) {
        if (Date.now() > deadline) throw new Error(`Timed out waiting for ${what}`);
        await mountedOne.wait(10);
      }
    },
    async wait(ms) {
      await act(() => new Promise((resolve) => setTimeout(resolve, ms)));
      await settle();
    },
    async unmount() {
      if (closed) return;
      closed = true;
      mounted.delete(mountedOne);
      tree.unmount();
      await bench.close();
    },
  };
  mounted.add(mountedOne);
  return mountedOne;
}
