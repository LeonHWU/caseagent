import type Anthropic from "@anthropic-ai/sdk";
import { visibleEvents } from "./cut.ts";
import type { Case } from "./parse.ts";
import { renderCase } from "./prompt.ts";
import type { CaseState } from "./state.ts";
import { runTool, TOOL_SPECS } from "./tools.ts";

export const MAX_TURNS = 15;
const NUDGE = "End the run now with exactly one of hold, escalate or close_case.";

export type ModelClient = {
  messages: { create(p: Anthropic.MessageCreateParamsNonStreaming): Promise<Anthropic.Message> };
};

export type Trace = (kind: string, data: Record<string, unknown>) => void;

export async function runCase(opts: {
  c: Case;
  state: CaseState;
  newFrom: number;
  client: ModelClient;
  model: string;
  policy: string;
  trace: Trace;
  singleStep?: boolean;
}): Promise<string[]> {
  const { c, state, client, model, policy, trace } = opts;
  state.runs += 1;
  state.status = { kind: "open" };
  const visible = visibleEvents(c, state.initialSeen, state.seen);
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: renderCase(c, state, visible, opts.newFrom) }];
  const thoughts: string[] = [];
  trace("run_start", { case: c.id, run: state.runs, seen: state.seen, model });

  for (let turn = 1; turn <= MAX_TURNS; turn++) {
    const resp = await client.messages.create({ model, max_tokens: 4096, system: opts.singleStep ? `${policy}\nExecute exactly one tool action for this invocation. Do not chain actions.` : policy, tools: TOOL_SPECS, messages });
    trace("model", { turn, stop: resp.stop_reason, usage: resp.usage, content: resp.content });
    messages.push({ role: "assistant", content: resp.content });
    for (const b of resp.content) if (b.type === "text" && b.text.trim()) thoughts.push(b.text.trim());

    const uses = resp.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
    if (uses.length === 0) {
      messages.push({ role: "user", content: NUDGE });
      continue;
    }
    const results: Anthropic.ToolResultBlockParam[] = [];
    for (const u of uses) {
      const out = runTool(u.name, u.input, state);
      state.actions.push({ run: state.runs, afterEvent: state.seen, tool: u.name, input: u.input as Record<string, unknown>, ok: out.ok, result: out.result });
      trace("tool", { name: u.name, input: u.input, ...out });
      if (out.ends || opts.singleStep) return thoughts;
      results.push({ type: "tool_result", tool_use_id: u.id, content: out.result, is_error: !out.ok });
    }
    messages.push({ role: "user", content: results });
  }

  state.incomplete = true;
  state.status = { kind: "escalated", summary: `The agent did not end the run within ${MAX_TURNS} turns. A person must review case ${c.id}.` };
  trace("auto_escalate", { turns: MAX_TURNS });
  return thoughts;
}
