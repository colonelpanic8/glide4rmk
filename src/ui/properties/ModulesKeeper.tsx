// Keeps the add-on modules a layout turns on (ADR 0028): a layout file opened
// without a keyboard brings its own; for a connected keyboard they are kept in
// this browser (by serial), read when it connects and saved after each change,
// as its behavior labels are (LabelKeeper).

import { useEffect, useRef } from "react";
import { readSetting, SETTING_KEYS, writeSetting } from "../settings";
import { useWorkbench } from "../state";
import { modulesFromFile } from "../../config/add-ons";
import { readModules, writeModules } from "../../model/boards/add-ons";

export function ModulesKeeper() {
  const { bundle, state, dispatch } = useWorkbench();
  const offline = bundle.session.kind === "offline";
  const key = SETTING_KEYS.layoutModules(bundle.info.serial_number);
  const loaded = useRef<string | null>(null);
  /** What was just loaded, until the state has it: nothing is saved before then. */
  const arriving = useRef<string | null>(null);
  const workspace = bundle.workspace;

  useEffect(() => {
    if (loaded.current === key) return;
    loaded.current = key;
    const modules = offline
      ? workspace?.sourceText ? modulesFromFile(workspace.sourceText, workspace.format) : []
      : readModules(readSetting(key));
    arriving.current = writeModules(modules);
    dispatch({ type: "notesLoaded", notes: { modules } });
  }, [key, offline, workspace, dispatch]);

  useEffect(() => {
    const text = writeModules(state.modules);
    if (arriving.current !== null) {
      if (text === arriving.current) arriving.current = null;
      return;
    }
    if (!offline && loaded.current === key) writeSetting(key, text);
  }, [state.modules, key, offline]);

  return null;
}
