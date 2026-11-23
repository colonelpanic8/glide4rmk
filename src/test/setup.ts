// Runs before every test file (vite.config.ts): the wasm modules, and simulated
// boards that answer at once. Their 5–15 ms per call was most of the suite's
// time; a test about slowness sets its own (setSimulatedLatency).

import "./wasm";
import { setSimulatedLatency } from "../session/mock/latency";

setSimulatedLatency(0);
