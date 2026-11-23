// Runs before every test file (vite.config.ts): the wasm modules, simulated
// boards that answer at once, and the screens' workbench stores back at their
// start after each test. The boards' 5–15 ms per call was most of the suite's
// time; a test about slowness sets its own (setSimulatedLatency).

import { afterEach } from "vitest";
import "./wasm";
import { setSimulatedLatency } from "../session/mock/latency";
import { resetWorkbenchStores } from "./workbench-stores";

setSimulatedLatency(0);
afterEach(resetWorkbenchStores);
