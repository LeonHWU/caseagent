import type Anthropic from "@anthropic-ai/sdk";
import { visibleEvents } from "./cut.ts";
import type { Case } from "./parse.ts";
import type { CasePrompt } from "./prompt.ts";
import { renderCase } from "./prompt.ts";
import type { CaseState } from "./state.ts";
import { runTool, TOOL_SPECS, type ToolAdapter } from "./tools.ts";

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
  caseDir?: string;
  cacheDir?: string;
  adapters?: Record<string, ToolAdapter>;
}): Promise<string[]> {
  const { c, state, client, model, policy, trace, caseDir, cacheDir, adapters } = opts;
  state.runs += 1;
  state.status = { kind: "open" };
  const visible = visibleEvents(c, state.initialSeen, state.seen);
  const prompt = await renderCase(c, state, visible, opts.newFrom, caseDir, cacheDir);

  // Build message content with text and images
  const content: Anthropic.ContentBlockParam[] = [
    { type: "text", text: prompt.text },
    ...prompt.images.map((img) => ({
      type: "image" as const,
      source: {
        type: "base64" as const,
        media_type: img.format === "png" ? ("image/png" as const) : ("image/jpeg" as const),
        data: img.data,
      },
    })),
  ];

  const messages: Anthropic.MessageParam[] = [{ role: "user", content }];
  const thoughts: string[] = [];
  trace("run_start", { case: c.id, run: state.runs, seen: state.seen, model });

  // Add cache control to tools - last tool definition gets the breakpoint
  const toolsWithCache: Anthropic.Tool[] = TOOL_SPECS.map((t, i) => ({
    ...t,
    ...(i === TOOL_SPECS.length - 1 ? { cache_control: { type: "ephemeral" } } : {}),
  })) as Anthropic.Tool[];

  for (let turn = 1; turn <= MAX_TURNS; turn++) {
    // Add cache_control to system and message content
    const systemParam: Anthropic.MessageCreateParamsNonStreaming["system"] = [
      { type: "text", text: policy, cache_control: { type: "ephemeral" } },
    ];

    const messagesForRequest: Anthropic.MessageParam[] = messages.map((msg, idx) => {
      if (idx === messages.length - 1 && msg.role === "user" && Array.isArray(msg.content)) {
        // Add cache_control to the last content block of the latest message
        const content = msg.content.map((block, blockIdx) => {
          const lastBlock = blockIdx === msg.content.length - 1;
          return lastBlock && typeof block === "object" ? { ...block, cache_control: { type: "ephemeral" } } : block;
        }) as Anthropic.MessageParam["content"];
        return { ...msg, content };
      }
      return msg;
    });

    const resp = await client.messages.create({
      model,
      max_tokens: 4096,
      system: systemParam,
      tools: toolsWithCache,
      messages: messagesForRequest,
    });

    trace("model", { turn, stop: resp.stop_reason, usage: resp.usage, content: resp.content });
    messages.push({ role: "assistant", content: resp.content });

    // Extract and store text blocks as notes
    for (const b of resp.content) {
      if (b.type === "text" && b.text.trim()) {
        thoughts.push(b.text.trim());
        state.notes.push({ run: state.runs, afterEvent: state.seen, text: b.text.trim() });
      }
    }

    const uses = resp.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
    if (uses.length === 0) {
      messages.push({ role: "user", content: NUDGE });
      continue;
    }
    const results: Anthropic.ToolResultBlockParam[] = [];
    for (const u of uses) {
      const out = runTool(u.name, u.input, state, adapters);
      state.actions.push({ run: state.runs, afterEvent: state.seen, tool: u.name, input: u.input as Record<string, unknown>, ok: out.ok, result: out.result });
      trace("tool", { name: u.name, input: u.input, ...out });
      if (out.ends) return thoughts;
      results.push({ type: "tool_result", tool_use_id: u.id, content: out.result, is_error: !out.ok });
    }
    messages.push({ role: "user", content: results });
  }

  state.incomplete = true;
  state.status = { kind: "escalated", summary: `The agent did not end the run within ${MAX_TURNS} turns. A person must review case ${c.id}.` };
  trace("auto_escalate", { turns: MAX_TURNS });
  return thoughts;
}
