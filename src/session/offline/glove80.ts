// The offline board as a Glove80: what a new file opens on, and what most
// tests open a layout on.

import type { ExtensionCatalog, RuntimeSnapshot } from "../../config/document";
import type { LightingTopology, RynkSession } from "../types";
import type { BoardSpec } from "../mock/board";
import {
  offlineBoard,
  offlineCatalog,
  offlineTopology,
  openOfflineBoard,
  type OfflineBoardOptions,
} from "./board";

export type OfflineGlove80Options = OfflineBoardOptions;

export const offlineGlove80Catalog = (): ExtensionCatalog => offlineCatalog("glove80");

export const offlineGlove80Topology = (): LightingTopology => offlineTopology("glove80");

export const offlineGlove80Board = (snapshot?: RuntimeSnapshot, options?: OfflineBoardOptions): BoardSpec =>
  offlineBoard("glove80", snapshot, options);

export const openOfflineGlove80 = (snapshot?: RuntimeSnapshot, options?: OfflineBoardOptions): RynkSession =>
  openOfflineBoard("glove80", snapshot, options);
