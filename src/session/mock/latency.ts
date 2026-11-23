// How long a simulated board takes to answer.

/** How long a simulated call takes: 5–15 ms, so the UI's loading states are
 *  exercised honestly. Tests set it to 0 (`src/test/setup.ts`): the wait is
 *  most of the suite's time and makes timing vary from run to run. */
let simulatedLatency = { min: 5, spread: 10 };

/** Sets how long every simulated call takes: `min` ms plus up to `spread` ms at random. */
export function setSimulatedLatency(min: number, spread = 0): void {
  simulatedLatency = { min, spread };
}

/** Resolve `work`'s result after the simulated latency, rejecting if it throws. */
export function latency<T>(work: () => T): Promise<T> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      try {
        resolve(work());
      } catch (error) {
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    }, simulatedLatency.min + Math.random() * simulatedLatency.spread);
  });
}
