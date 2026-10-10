import type Anthropic from "@anthropic-ai/sdk";
import { visibleEvents } from "./cut.ts";
import type { Case } from "./parse.ts";
import { renderCase } from "./prompt.ts";
import type { CaseState } from "./state.ts";
import { runTool, TOOL_SPECS, type ToolAdapter } from "./tools.ts";
import { playbookContext, type PlaybookOptions } from "./playbooks.ts";

export const MAX_TURNS = 15;
// The agency's own records of a landlord approval that came before the agent's first run.
const APPROVAL_ON_FILE = /landlord approval confirmed|landlord who approved/i;
const NUDGE = "End the run now with exactly one of hold, escalate or close_case.";

export type ModelClient = {
  messages: { create(p: Anthropic.MessageCreateParamsNonStreaming): Promise<Anthropic.Message> };
};

export type Trace = (kind: string, data: Record<string, unknown>) => void;

export function casePolicy(policy: string, singleStep = false): string {
  return singleStep ? `${policy}\nInvocation contract: execute exactly one business tool action. Do not chain actions. After a message, approval request, assignment or note, saved status may remain open; a later invocation can hold, escalate or close. The normal end-tool requirement applies to a complete stage, not to this single-action invocation.` : policy;
}

export async function runCase(opts: {
  c: Case;
  state: CaseState;
  newFrom: number;
  client: ModelClient;
  model: string;
  policy: string;
  trace: Trace;
  caseDir?: string;
  adapters?: Record<string, ToolAdapter>;
  singleStep?: boolean;
  playbooks?: PlaybookOptions | false;
}): Promise<void> {
  const { c, state, client, model, policy, trace, caseDir, adapters } = opts;
  state.runs += 1;
  state.status = { kind: "open" };
  const visible = visibleEvents(c, state.initialSeen, state.seen);
  state.approvalOnFile = visible.some((e) => APPROVAL_ON_FILE.test(e.body));
  // Asking is not approval: a prior request counts only once a landlord event comes after it.
  const request = state.actions.find((a) => a.tool === "request_landlord_approval" && a.ok);
  state.landlordReplied = request ? visible.some((e) => e.n > request.afterEvent && /landlord/i.test(e.from)) : false;
  const prompt = await renderCase(c, state, visible, opts.newFrom, caseDir);

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
    ...prompt.documents.map((doc) => ({
      type: "document" as const,
      title: doc.filename,
      source: { type: "base64" as const, media_type: "application/pdf" as const, data: doc.data },
    })),
  ];

  const messages: Anthropic.MessageParam[] = [{ role: "user", content }];
  trace("run_start", { case: c.id, run: state.runs, seen: state.seen, model });

  const systemText = casePolicy(policy, opts.singleStep);
  const retrievalQuery = [c.title, c.request, ...visible.slice(-3).map((e) => e.body)].join("\n");

  // Add cache control to tools - last tool definition gets the breakpoint
  const toolsWithCache: Anthropic.Tool[] = TOOL_SPECS.map((t, i) => ({
    ...t,
    ...(i === TOOL_SPECS.length - 1 ? { cache_control: { type: "ephemeral" } } : {}),
  })) as Anthropic.Tool[];

  for (let turn = 1; turn <= MAX_TURNS; turn++) {
    // Reassess after each tool result; a resumed run uses only its newly visible state.
    const currentActions = state.actions.map((a) => ({ tool: a.tool, input: a.input, ok: a.ok, result: a.result }));
    const references = opts.playbooks ? await playbookContext({
      options: opts.playbooks, client, model, policy,
      query: `${retrievalQuery}\n${JSON.stringify(currentActions)}`,
      currentEvidence: [
        { id: "title", text: c.title }, { id: "details", text: c.details }, { id: "request", text: c.request },
        ...visible.map((e) => ({ id: `event:${e.n}`, text: `${e.at} | ${e.channel} | from ${e.from} | to ${e.to}\n${e.body}` })),
        ...currentActions.map((a, i) => ({ id: `action:${i}`, text: JSON.stringify(a) })),
      ].filter((e) => e.text.trim()), trace, turn,
    }) : "";
    // Add cache_control to system and message content
    const systemParam: Anthropic.MessageCreateParamsNonStreaming["system"] = [
      { type: "text", text: systemText + references, cache_control: { type: "ephemeral" } },
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
        state.notes.push({ run: state.runs, afterEvent: state.seen, text: b.text.trim() });
      }
    }

    const uses = resp.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
    if (uses.length === 0) {
      messages.push({ role: "user", content: opts.singleStep ? "Execute exactly one next business action through the available tools. Do not chain actions or claim an action occurred before its tool result." : NUDGE });
      continue;
    }
    const results: Anthropic.ToolResultBlockParam[] = [];
    for (const u of uses) {
      const out = runTool(u.name, u.input, state, adapters);
      state.actions.push({ run: state.runs, afterEvent: state.seen, tool: u.name, input: u.input as Record<string, unknown>, ok: out.ok, result: out.result });
      trace("tool", { name: u.name, input: u.input, ...out });
      if (out.ends || opts.singleStep) return;
      results.push({ type: "tool_result", tool_use_id: u.id, content: out.result, is_error: !out.ok });
    }
    messages.push({ role: "user", content: results });
  }

  state.incomplete = true;
  state.status = { kind: "escalated", summary: `The agent did not end the run within ${MAX_TURNS} turns. A person must review case ${c.id}.` };
  trace("auto_escalate", { turns: MAX_TURNS });
}
