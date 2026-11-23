// A key's slots in the key editor, as in GLIDE: On Tap always, On Hold and On
// Double Tap when set, else a chip that adds them. The slot being filled is
// marked; the tabs beside the list fill it. A slot's handle drags it onto
// another slot to swap their actions (model/key-slots.ts swapSlots). A double
// tap a fork makes (model/key-behavior.ts) shows as On Double Tap, named, and
// stays put. The gear on a slot opens the key's timing (TimingPanel).

import type { Action } from "../../model/action-types";
import type { Slot, SlotsOf } from "../../model/key-slots";

import { cx } from "../kit";
import { GearIcon, GripIcon, TrashIcon } from "../icons";
import { useKeyText } from "../useKeyText";
import { useRowDrag } from "../sidepanel/useRowDrag";

const SLOTS: readonly Slot[] = ["tap", "hold", "doubleTap"];

const SLOT_NAME: Record<Slot, string> = { tap: "On Tap", hold: "On Hold", doubleTap: "On Double Tap" };

const CLEAR_HINT: Record<Slot, string> = {
  tap: "Clear the tap",
  hold: "Remove the hold",
  doubleTap: "Remove the double tap",
};

const PICK_HINT: Record<Slot, string> = {
  tap: "Pick what the key does →",
  hold: "Pick what the key does when held →",
  doubleTap: "Pick what the key does when pressed twice →",
};

/** A slot as GLIDE draws it: one row, its name on the left, what it does on the
 *  right, and a bin. The whole row picks it as the slot the tabs fill. */
function SlotRow({
  slot,
  value,
  active,
  drag,
  via,
  gear,
  onSelect,
  onClear,
}: {
  slot: Slot;
  value: Action;
  active: boolean;
  /** The behavior that makes this slot, when it is not the key's own (a fork). */
  via?: string;
  gear?: SlotGear;
  /** Its handle, and whether it is being dragged or is where a dragged slot would land. */
  drag: { handle: ReturnType<ReturnType<typeof useRowDrag>["handle"]>; lifted: boolean; over: boolean } | null;
  onSelect: () => void;
  onClear: () => void;
}) {
  const keyText = useKeyText();
  const empty = value === "No";
  return (
    <div
      data-row={SLOTS.indexOf(slot)}
      className={cx(
        "flex h-[42px] items-center gap-1.5 rounded-xl border pr-3 transition-colors",
        active ? "border-accent bg-accent-dim" : "border-line bg-raised hover:border-line-strong",
        drag?.lifted && "border-dashed opacity-40",
        drag?.over && "ring-2 ring-accent",
      )}
    >
      {drag ? (
        <span
          {...drag.handle}
          title="Drag onto another action to swap"
          className="-mr-1.5 flex h-full shrink-0 cursor-grab items-center pr-1 pl-3 text-ink opacity-70 select-none hover:opacity-100"
        >
          <GripIcon size={12} />
        </span>
      ) : (
        <span className="w-1.5 shrink-0" />
      )}
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={active}
        className="flex h-full min-w-0 flex-1 cursor-pointer items-center gap-1.5 text-left"
      >
        <span className="flex shrink-0 flex-col pl-1.5 leading-tight">
          <span className="text-body font-semibold text-ink">{SLOT_NAME[slot]}:</span>
          {via && <span title={`Made by the fork ${via}`} className="max-w-28 truncate text-caption text-mute">via {via}</span>}
        </span>
        <span
          className={cx(
            "ml-auto truncate pr-2 font-semibold",
            empty ? "text-small text-faint" : "font-mono text-small text-ink",
          )}
        >
          {empty ? "Pick an action →" : keyText.label(value) || keyText.describeAction(value)}
        </span>
      </button>
      {gear && (
        <button
          type="button"
          onClick={gear.onToggle}
          aria-pressed={gear.open}
          aria-label="Timing"
          title="Timing"
          className={cx(
            "mr-1 flex size-6 shrink-0 cursor-pointer items-center justify-center rounded border",
            gear.open ? "border-accent bg-accent-fill text-on-accent" : "border-line-strong text-mute hover:text-ink",
          )}
        >
          <GearIcon size={13} />
        </button>
      )}
      <button
        type="button"
        onClick={onClear}
        aria-label={`Clear ${SLOT_NAME[slot]}`}
        title={CLEAR_HINT[slot]}
        className="flex size-6 shrink-0 cursor-pointer items-center justify-center rounded border border-accent/15 text-accent hover:bg-accent-dim"
      >
        <TrashIcon size={14} />
      </button>
    </div>
  );
}

/** The gear on the slot the key's timing belongs to. */
export interface SlotGear {
  slot: Slot;
  open: boolean;
  onToggle: () => void;
}

export function SlotList({
  slots,
  active,
  offerDoubleTap,
  doubleTapVia,
  gear,
  onSelect,
  onClear,
  onSwap,
}: {
  slots: SlotsOf;
  active: Slot;
  /** The keyboard can do a double tap (capability `keys.doubleTap`). */
  offerDoubleTap: boolean;
  /** The fork that makes the double tap, by name, when one does. */
  doubleTapVia: string | null;
  gear: SlotGear | null;
  onSelect: (slot: Slot) => void;
  onClear: (slot: Slot) => void;
  /** Swap two slots' actions (a slot dragged by its handle onto another). */
  onSwap: (from: Slot, to: Slot) => void;
}) {
  const rows = useRowDrag((from, to) => onSwap(SLOTS[from], SLOTS[to]));
  const extra: Array<Exclude<Slot, "tap">> = offerDoubleTap || doubleTapVia !== null ? ["hold", "doubleTap"] : ["hold"];
  const set = extra.filter((slot) => slots[slot] !== null);
  const unset = extra.filter((slot) => slots[slot] === null);
  // A fork's double tap is not the key's own: it does not swap with the others.
  const movable = (slot: Slot) => !(slot === "doubleTap" && doubleTapVia !== null);
  const shown = 1 + set.filter(movable).length;
  const row = (slot: Slot, value: Action) => (
    <SlotRow
      key={slot}
      slot={slot}
      value={value}
      active={active === slot}
      via={slot === "doubleTap" ? (doubleTapVia ?? undefined) : undefined}
      gear={gear?.slot === slot ? gear : undefined}
      drag={
        shown > 1 && movable(slot)
          ? {
              handle: rows.handle(SLOTS.indexOf(slot)),
              lifted: rows.drag?.from === SLOTS.indexOf(slot),
              over: rows.drag !== null && rows.drag.over === SLOTS.indexOf(slot) && rows.drag.from !== rows.drag.over,
            }
          : null
      }
      onSelect={() => onSelect(slot)}
      onClear={() => onClear(slot)}
    />
  );

  return (
    <>
      {row("tap", slots.tap)}
      {set.map((slot) => row(slot, slots[slot]!))}
      {unset.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {unset.map((slot) => (
            <button
              key={slot}
              type="button"
              onClick={() => onSelect(slot)}
              aria-pressed={active === slot}
              className={cx(
                "flex cursor-pointer items-center gap-1 rounded-full border border-dashed px-2.5 py-1 text-small leading-4 font-semibold transition-colors",
                active === slot ? "border-accent text-accent" : "border-line-strong text-ink hover:border-mute",
              )}
            >
              <span className="text-accent">+</span> {SLOT_NAME[slot]}
            </button>
          ))}
        </div>
      )}
      {slots[active] === null && <p className="text-small text-accent">{PICK_HINT[active]}</p>}
    </>
  );
}
