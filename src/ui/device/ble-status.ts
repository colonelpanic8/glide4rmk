import type { RynkSession } from "../../session/types";
import { selectedBle, type ConnectionStatus, type SelectedBle } from "../../model/device-state";

interface BleReadback {
  connection: ConnectionStatus;
  ble: SelectedBle;
}

/** Profile commands acknowledge queueing; the selected slot can settle later. */
export async function readBleStatus(session: RynkSession, expectedProfile?: number): Promise<BleReadback> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const connection = await session.device.connectionStatus();
    const ble = selectedBle(connection);
    if (expectedProfile === undefined || ble.profile === expectedProfile) return { connection, ble };
    if (attempt < 19) await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Bluetooth profile ${expectedProfile} did not become active`);
}
