// @vitest-environment happy-dom
// Todo 7: does clicking keys write to the clipboard? On the whole workbench,
// on each kind of computer, no gesture that selects, moves or opens a key's
// menu writes it; only Ctrl or ⌘ with C on a selected key does.

import { afterEach, describe, expect, it, vi } from "vitest";
import { mockProvider } from "../../session/mock/board";
import { glove80Board } from "../../session/mock/glove80";
import { mount } from "../../test/mount";
import { openBundle } from "../../workbench/open";
import { Workbench } from "../Workbench";
import { act } from "react";

const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 20)));
function fire(target: Element, type: string, init: Record<string, unknown> = {}) {
  const Event = type.startsWith("pointer") ? PointerEvent : type.startsWith("key") ? KeyboardEvent : MouseEvent;
  act(() => {
    target.dispatchEvent(new Event(type, { bubbles: true, cancelable: true, pointerId: 1, clientX: 5, clientY: 5, ...init }));
  });
}
const press = (target: Element, held: Record<string, boolean> = {}, button = 0) => {
  fire(target, "pointerdown", { button, buttons: 1 << button, ...held });
  fire(target, "pointerup", { button, ...held });
  fire(target, button === 2 ? "contextmenu" : "click", { button, ...held });
};

afterEach(() => vi.restoreAllMocks());

for (const [computer, platform, command] of [
  ["Windows", "Win32", "ctrlKey"],
  ["an Apple computer", "MacIntel", "metaKey"],
] as const) {
  describe(`clicking keys on ${computer}`, () => {
    it("never writes to the clipboard; Ctrl or ⌘ with C does", async () => {
      vi.spyOn(navigator, "platform", "get").mockReturnValue(platform);
      const write = vi.spyOn(navigator.clipboard, "writeText");
      const session = await mockProvider(glove80Board).connect();
      try {
        const page = mount(<Workbench bundle={await openBundle(session)} onClose={() => {}} onUnexpectedDisconnect={() => {}} />);
        await settle();
        const key = (row: number, col: number) => page.page.querySelector(`[data-key="${row},${col}"]`)!;
        press(key(0, 0));
        press(key(0, 1), { ctrlKey: true });
        press(key(0, 2), { metaKey: true });
        press(key(0, 3), { shiftKey: true });
        press(key(1, 3), {}, 2);
        fire(document.body, "keydown", { key: "Escape" });
        fire(key(2, 2), "keydown", { key: "Enter" });
        fire(key(2, 2), "keydown", { key: command === "ctrlKey" ? "Control" : "Meta", [command]: true });
        await settle();
        expect(write).not.toHaveBeenCalled();

        fire(document.body, "keydown", { key: "c", [command]: true });
        await settle();
        expect(write).toHaveBeenCalledTimes(1);
        page.unmount();
      } finally {
        await session.close();
      }
    });
  });
}
