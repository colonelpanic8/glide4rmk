// jq in the browser (ADR 0025): jq-web's wasm build in a Web Worker, started
// the first time a Flow runs. A script still running at the time limit is
// stopped by ending the worker; the next run starts a new one. The worker is
// built from a small script of its own, so jq-web loads as the classic script
// it is, finding its .wasm through `locateFile`.

import jqScriptUrl from "jq-web/jq.wasm.js?url";
import jqWasmUrl from "jq-web/jq.wasm.wasm?url";
import { readableJqError, timedOut, type JqResult, type JqRunner } from "../../operations/flows";

interface Job {
  resolve(result: JqResult): void;
  lineOffset: number;
  timer: ReturnType<typeof setTimeout>;
}

function workerSource(): string {
  const absolute = (url: string) => JSON.stringify(new URL(url, window.location.href).href);
  return [
    `self.jq = { locateFile: function () { return ${absolute(jqWasmUrl)}; } };`,
    `importScripts(${absolute(jqScriptUrl)});`,
    "onmessage = function (event) {",
    "  var job = event.data;",
    "  jq.promised.json(job.input, job.program).then(",
    "    function (output) { postMessage({ id: job.id, output: output }); },",
    "    function (error) { postMessage({ id: job.id, error: String((error && error.message) || error), detail: String((error && error.stack) || '') }); }",
    "  );",
    "};",
  ].join("\n");
}

export function browserJq(): JqRunner {
  let worker: Worker | null = null;
  let nextId = 1;
  const jobs = new Map<number, Job>();

  const stop = (message: string) => {
    worker?.terminate();
    worker = null;
    for (const job of jobs.values()) {
      clearTimeout(job.timer);
      job.resolve({ ok: false, message });
    }
    jobs.clear();
  };

  const start = (): Worker => {
    const url = URL.createObjectURL(new Blob([workerSource()], { type: "text/javascript" }));
    const started = new Worker(url);
    URL.revokeObjectURL(url);
    started.onmessage = (event: MessageEvent<{ id: number; output?: unknown; error?: string; detail?: string }>) => {
      const { id, output, error, detail } = event.data;
      const job = jobs.get(id);
      if (!job) return;
      jobs.delete(id);
      clearTimeout(job.timer);
      job.resolve(error === undefined ? { ok: true, output } : { ok: false, message: readableJqError(error, detail ?? "", job.lineOffset) });
    };
    started.onerror = () => stop("The jq engine could not start. Nothing was changed.");
    return started;
  };

  return {
    run(input, program, { lineOffset, timeoutMs }) {
      worker ??= start();
      const running = worker;
      const id = nextId++;
      return new Promise<JqResult>((resolve) => {
        const timer = setTimeout(() => {
          jobs.delete(id);
          if (worker === running) stop("The jq engine stopped. Nothing was changed.");
          resolve(timedOut(timeoutMs));
        }, timeoutMs);
        jobs.set(id, { resolve, lineOffset, timer });
        running.postMessage({ id, input, program });
      });
    },
  };
}
