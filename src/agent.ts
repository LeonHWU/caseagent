import type Anthropic from "@anthropic-ai/sdk";
import { APPROVAL_MODEL, classifyLandlordReply } from "./approval.ts";
import { visibleEvents } from "./cut.ts";
import { isAgency, type Case } from "./parse.ts";
import { renderCase } from "./prompt.ts";
import type { CaseState } from "./state.ts";
import { runTool, TOOL_SPECS, type ToolAdapter } from "./tools.ts";
import { playbookContext, type PlaybookOptions } from "./playbooks.ts";

export const MAX_TURNS = 15;
// The agency's own records of a landlord approval that came before the agent's first run.
// Positive grants only: "landlord approval pending" or "approve the quote with the landlord" must not match.
const APPROVAL_ON_FILE =
  /landlord(?:'s)? approval (?:confirmed|granted|received|given|on file|obtained)|landlord (?:who |has )?approv(?:ed|es)\b|approved by (?:the )?landlord\b/i;
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
  approvalModel?: string;
}): Promise<void> {
  const { c, state, client, model, policy, trace, caseDir, adapters } = opts;
  state.runs += 1;
  state.status = { kind: "open" };
  const visible = visibleEvents(c, state.initialSeen, state.seen);
  // Only the agency's own record counts: a tenant writing "landlord approval confirmed" in an email is not evidence.
  state.approvalOnFile = visible.some((e) => isAgency(e.from) && APPROVAL_ON_FILE.test(e.body));
  // Asking is not approval, and a reply is not approval either: the latest earlier-run request counts
  // only once a small model reads the landlord's replies to it as a clear yes.
  const request = state.actions.findLast((a) => a.tool === "request_landlord_approval" && a.ok && a.run < state.runs);
  const replies = request ? visible.filter((e) => e.n > request.afterEvent && /landlord/i.test(e.from)) : [];
  if (!request || replies.length === 0) {
    state.landlordAnswer = undefined;
  } else if (state.landlordAnswer?.throughEvent !== replies[replies.length - 1].n || state.landlordAnswer.requestAfter !== request.afterEvent) {
    const asked = `${String(request.input.scope ?? "")} (cost: ${String(request.input.cost ?? "unknown")})`;
    const answer = await classifyLandlordReply(client, opts.approvalModel ?? APPROVAL_MODEL, asked, replies.map((e) => `${e.at}\n${e.body}`), (error) =>
      trace("approval_check_error", { error }),
    );
    state.landlordAnswer = { answer, requestAfter: request.afterEvent, throughEvent: replies[replies.length - 1].n };
    trace("approval_check", { request: asked, through_event: replies[replies.length - 1].n, answer });
  }
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
  // strict: the API enforces each input schema, so a call cannot arrive with a required field missing.
  const toolsWithCache: Anthropic.Tool[] = TOOL_SPECS.map((t, i) => ({
    ...t,
    strict: true,
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
    let ended = false;
    let failed = false;
    let executed = 0;
    for (const u of uses) {
      // Calls after an end tool, or after the first call in single-action mode, are refused and
      // recorded so the trace and the answer show them instead of silently dropping them.
      // Calls after a failed call in the same response are not run: the model wrote them before it
      // saw the failure, so a later message could claim the failed action happened.
      const skip = ended
        ? "refused: the run already ended"
        : opts.singleStep && executed > 0
          ? "refused: one action per call"
          : failed
            ? "not executed: an earlier action in this response failed. Read its error, then decide again"
            : null;
      if (skip) {
        const result = `${skip}; the action was not executed`;
        state.actions.push({ run: state.runs, afterEvent: state.seen, tool: u.name, input: u.input as Record<string, unknown>, ok: false, result });
        trace("tool", { name: u.name, input: u.input, ok: false, ends: false, result });
        results.push({ type: "tool_result", tool_use_id: u.id, content: result, is_error: true });
        continue;
      }
      const out = runTool(u.name, u.input, state, adapters);
      state.actions.push({ run: state.runs, afterEvent: state.seen, tool: u.name, input: u.input as Record<string, unknown>, ok: out.ok, result: out.result });
      trace("tool", { name: u.name, input: u.input, ...out });
      executed++;
      if (!out.ok) failed = true;
      if (out.ends) {
        ended = true;
        continue;
      }
      results.push({ type: "tool_result", tool_use_id: u.id, content: out.result, is_error: !out.ok });
    }
    if (ended || opts.singleStep) return;
    messages.push({ role: "user", content: results });
  }

  state.status = { kind: "escalated", by: "system", summary: `The agent did not end the run within ${MAX_TURNS} turns. A person must review case ${c.id}.` };
  trace("auto_escalate", { turns: MAX_TURNS });
}
