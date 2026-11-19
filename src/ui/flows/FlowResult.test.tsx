import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { newFlowLog, readFlowFile } from "../../operations/flows";
import type { FlowRun } from "../../workbench/flows";
import { FlowResultBar, FlowResultBody } from "./FlowResult";

const read = readFlowFile('runs_on = "glide4rmk"\nuid = "my_flow"\ntitle = "My flow"\ncategory = "Symbols"\nscript = "."\n', "shared/my.flows");
if (!read.ok) throw new Error(read.message);
const flow = read.flow;
const log = (outcome: FlowRun["log"]["outcome"]) => ({ ...newFlowLog(flow, new Date(0)), outcome });
const done: FlowRun = { ok: true, message: "3 keys retyped.", report: { changed: true, message: "", lines: [{ text: "Retyped 3 keys", ok: true }], log: [] }, log: log("done") };
const stopped: FlowRun = { ok: false, message: "Your layout has no Base layer, so nothing was changed.", report: null, log: log("stopped") };
const bar = (run: FlowRun) => renderToStaticMarkup(<FlowResultBar run={run} category="Symbols" onDone={() => {}} onUndo={() => {}} onTryAgain={() => {}} onBack={() => {}} />);

describe("a Flow's result, as GLIDE shows it", () => {
  it("says it was applied, what it did, that it waits for Send in Draft, and offers Done and Undo", () => {
    const html = renderToStaticMarkup(<FlowResultBody flow={flow} run={done} drafted />);
    expect(html).toContain('data-ok="true"');
    expect(html).toContain("My flow has been applied to your layout.");
    expect(html).toContain("Retyped 3 keys");
    expect(html).toContain("Review &amp; send");
    expect(html).toContain("Troubleshooting details");
    expect(bar(done)).toContain('data-testid="flow-done"');
    expect(bar(done)).toContain('data-testid="flow-undo"');
    expect(bar(done)).toContain("← Back to Symbols");
  });

  it("says why it stopped and offers Try again, no Undo", () => {
    const html = renderToStaticMarkup(<FlowResultBody flow={flow} run={stopped} drafted={false} />);
    expect(html).toContain('data-ok="false"');
    expect(html).toContain("Your layout has no Base layer, so nothing was changed.");
    expect(bar(stopped)).toContain('data-testid="flow-retry"');
    expect(bar(stopped)).not.toContain('data-testid="flow-undo"');
  });
});
