// The key editor, below the keyboard, as in GLIDE (in EditorPanel's frame).
// Left: which key it is, the behavior it is bound to (KeyBehavior), and its
// actions as slots (On Tap; On Hold, a tap-hold; On Double Tap, a morse entry
// of its own, written by model/key-slots' plan, or the fork that makes it).
// The gear on a slot opens the key's timing (TimingPanel).
// The tabs fill the active slot: Pick Key, Switch Layer, Other Behaviors (your
// macros and tap patterns, one-shot modifiers), and Key Lighting, with the
// lighting keys that show their own state at its foot. With several keys
// selected it edits the last one; only Key Lighting reaches all.

import { useEffect, useMemo, useState } from "react";
import type { Action, KeyAction } from "../../model/action-types";

import { keyFace } from "../keyface/keyFace";
import { useFaceContext } from "../keyface/useFaceContext";
import { keyAddressLabel, keyPlaceName } from "../key-address";
import { isDrafted, keyPendingId } from "../../workbench";
import { useWorkbench } from "../state";
import { useCapabilities } from "../use-capabilities";
import { selectedKeys } from "../../model/key-selection";

import { WarningIcon } from "../icons";
import { showToast } from "../messages/store";
import {
  morseUses,
  planSlotWrites,
  putSlot,
  swapSlots,
  slotsOf,
  type Slot,
  type SlotValues,
} from "../../model/key-slots";

import { OtherBehaviors } from "./OtherBehaviors";
import { EditorHeading, EditorPanel, EditorPrompt } from "./EditorPanel";
import { useEditorTabs, type EditorTab } from "./editorTabs";
import { LayerLighting } from "./LayerLighting";

import { PickKey } from "./PickKey";
import { isTapPattern, type Pick } from "./pickKey";
import { SlotList } from "./SlotList";
import { KeyBehavior } from "./KeyBehavior";
import { TimingPanel } from "./TimingPanel";
import { forkDoubleTap, keyTiming, withForkDoubleTap } from "../../model/key-behavior";
import { labelAt } from "../../model/behavior-labels";
import { SwitchLayer, type LayerKind } from "./SwitchLayer";
import { useKeyText } from "../useKeyText";

export function KeyEditor({ size = 310 }: { size?: number }) {
  const keyText = useKeyText();
  const { bundle, state, dispatch, io } = useWorkbench();
  const faceContext = useFaceContext();
  const capabilities = useCapabilities();
  const [tab, setTab] = useState<EditorTab>("pick");
  const [slot, setSlot] = useState<Slot>("tap");
  const [timingOpen, setTimingOpen] = useState(false);
  const selection = state.selection?.type === "key" ? state.selection : null;
  const selectionId = selection ? `${state.uiLayer}:${selection.row}:${selection.col}` : null;
  useEffect(() => {
    setSlot("tap");
    setTimingOpen(false);
  }, [selectionId]);
  const uses = useMemo(() => morseUses(state.layers), [state.layers]);

  const tabs = useEditorTabs(true);
  if (!selection) return <IdleKeyEditor size={size} tabs={tabs} tab={tab} onTab={setTab} />;

  const { row, col } = selection;
  const cols = bundle.caps.num_cols;
  const layer = state.uiLayer;
  const action: KeyAction = state.layers[layer]?.[row * cols + col] ?? "No";
  const pending = state.pending[keyPendingId(layer, row, col)];
  const staged = isDrafted(state, { kind: "key", layer, offset: row * cols + col });
  const key = bundle.model.keys.find((candidate) => candidate.row === row && candidate.col === col);
  const addressable = key ?? { row, col };
  const slots = slotsOf(action, state.morse);
  const commit = (next: KeyAction) => io.setKey(layer, row, col, next);
  /** Writes the morse entry (when the plan has one) before the key, and stops at the first failure. */
  const apply = async (next: SlotValues | "Transparent") => {
    const writes = planSlotWrites(action, next, state.morse, uses, state.forks);
    if (!writes) {
      showToast("Not changed: this key needs a tap pattern or fork of its own, and every slot is in use", { tone: "danger" });
      return;
    }
    for (const write of writes) {
      const result =
        write.kind === "morse"
          ? await io.setSlot("morse", write.index, write.entry)
          : write.kind === "fork"
            ? await io.setSlot("forks", write.index, write.fork)
            : await commit(write.binding);
      if (!result.ok) return;
    }
  };
  // A double tap a fork makes is changed in the fork; removing it removes the fork.
  const viaFork = slots.kind === "slots" ? forkDoubleTap(action, slots.tap, state.forks) : null;
  const forkWrite = async (value: Action | null) => {
    if (!viaFork) return;
    if (value === null) await io.apply("delete_behavior", { kind: "forks", slot: viaFork.fork });
    else await io.setSlot("forks", viaFork.fork, withForkDoubleTap(state.forks[viaFork.fork], value));
  };
  const put = (target: Slot, value: Action | null) =>
    target === "doubleTap" && viaFork && slots.kind === "slots" && slots.doubleTap === null
      ? forkWrite(value)
      : apply(putSlot(slots, target, value));
  // A tap pattern is the whole key; anything else fills the slot being picked.
  const fill = (value: Pick) =>
    value === "Transparent" ? apply("Transparent") : isTapPattern(value) ? commit(value) : put(slot, value);
  const pickLayer = (kind: LayerKind, target: number) => {
    if (kind === "HoldTap") {
      void put("hold", { LayerOn: target } as Action);
      setSlot("tap");
      setTab("pick");
      return;
    }
    void fill({ [kind]: target } as unknown as Action);
  };
  const glyph = keyFace(action, state.morse, faceContext);
  const shown = slots.kind === "slots" && viaFork && slots.doubleTap === null ? { ...slots, doubleTap: viaFork.action } : slots;
  const timed = keyTiming(action, state) !== null;
  const gearSlot: Slot | null =
    !timed || shown.kind !== "slots" ? null : shown.hold !== null ? "hold" : shown.doubleTap !== null && !viaFork ? "doubleTap" : "tap";
  const others = selectedKeys(selection).length - 1;

  const side = (
    <>
      <EditorHeading
        glyph={glyph}
        title={keyPlaceName(addressable)}
        detail={`Key ${keyAddressLabel(addressable).replace("-", " ")}${others > 0 ? ` · and ${others} more for RGB Lighting` : ""}`}
        onDone={() => dispatch({ type: "select", selection: null })}
        doneLabel="Done with this key"
      />

      <KeyBehavior action={action} doubleTapFork={viaFork?.fork ?? null} />

      {shown.kind === "slots" ? (
        <SlotList
          slots={shown}
          active={slot}
          offerDoubleTap={capabilities.has("keys.doubleTap")}
          doubleTapVia={viaFork ? labelAt(state.labels, "forks", viaFork.fork)?.name || `fork ${viaFork.fork}` : null}
          gear={gearSlot ? { slot: gearSlot, open: timingOpen, onToggle: () => setTimingOpen((open) => !open) } : null}
          onSelect={setSlot}
          onSwap={(from, to) => {
            const next = swapSlots(slots, from, to);
            if (next === null) return;
            void apply(next);
            setSlot(to);
          }}
          onClear={(target) => {
            if (target !== "tap") setSlot("tap");
            void put(target, null);
          }}
        />
      ) : (
        <p className="text-body leading-relaxed text-mute">
          {slots.kind === "transparent"
            ? "Same as the layer below. Pick an action to give this key its own."
            : slots.kind === "morse"
              ? `${keyText.describe(action)}. Edit it under Behaviors → Morse, or pick an action to replace it.`
              : `${keyText.describe(action)}. Edit it under Every action, or pick an action to replace it.`}
        </p>
      )}

      {timingOpen && gearSlot && (
        <TimingPanel
          key={JSON.stringify(action)}
          layer={layer}
          row={row}
          col={col}
          action={action}
          keyName={keyAddressLabel(addressable)}
          onClose={() => setTimingOpen(false)}
        />
      )}

      {pending?.status === "pending" && <p className="text-small text-accent">Writing to the keyboard…</p>}
      {staged && <p className="text-small text-accent">In the draft: goes to the keyboard when you send</p>}
      {pending?.status === "error" && (
        <div className="flex items-start gap-2 rounded-lg border border-danger/40 bg-danger-dim/25 px-3 py-2 text-body text-danger">
          <WarningIcon size={14} className="mt-0.5 shrink-0" />
          <div className="min-w-0 flex-1">
            <div>Not written: {pending.message}</div>
            <div className="mt-1 flex gap-3">
              {pending.attempted && (
                <button
                  type="button"
                  className="cursor-pointer font-semibold underline"
                  onClick={() => commit(pending.attempted!)}
                >
                  Retry
                </button>
              )}
              <button
                type="button"
                className="cursor-pointer text-mute underline"
                onClick={() => dispatch({ type: "keyErrDismiss", layer, row, col })}
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );

  return (
    <EditorPanel size={size} side={side} tabs={tabs} tab={tab} onTab={setTab}>
      {tab === "pick" && <PickKey onPick={fill} disabled={false} />}
      {tab === "layer" && <SwitchLayer onPick={pickLayer} disabled={false} />}
      {tab === "behaviors" && <OtherBehaviors onPick={fill} current={action} />}
      {tab === "lighting" && (
        <LayerLighting ledId={key?.ledId} />
      )}
    </EditorPanel>
  );
}

/** No key selected: the editor keeps its shape, as in GLIDE, with its tabs
 *  open and their content greyed out until a key is clicked. */
function IdleKeyEditor({
  size,
  tabs,
  tab,
  onTab,
}: {
  size: number;
  tabs: readonly EditorTab[];
  tab: EditorTab;
  onTab: (tab: EditorTab) => void;
}) {
  const none = () => {};
  const side = (
    <>
      <h2 className="text-title font-bold text-ink">No key selected</h2>
      <EditorPrompt>↑ Click a key on the keyboard to change what it does</EditorPrompt>
    </>
  );
  return (
    <EditorPanel size={size} side={side} tabs={tabs} tab={tab} onTab={onTab}>
      <p className="pb-3 text-center text-ui font-semibold text-ink">↑ Click a key on the keyboard first</p>
      {tab === "pick" && <PickKey onPick={none} disabled />}
      {tab === "layer" && <SwitchLayer onPick={none} disabled />}
    </EditorPanel>
  );
}
