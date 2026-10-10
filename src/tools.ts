import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { HOLD_REASONS, type CaseState } from "./state.ts";

export class Refusal extends Error {}

export type ToolOutcome = { ok: boolean; result: string; ends: boolean };
export type ToolAdapter = (input: Record<string, unknown>, state: CaseState) => string;

type Tool = {
  description: string;
  schema: z.ZodType;
  end: boolean;
  apply: (input: Record<string, unknown>, state: CaseState) => string;
};

function tool<S extends z.ZodType>(d: {
  description: string;
  schema: S;
  end?: boolean;
  apply: (input: z.infer<S>, state: CaseState) => string;
}): Tool {
  return { description: d.description, schema: d.schema, end: d.end ?? false, apply: (input, state) => d.apply(input as z.infer<S>, state) };
}

const reason = z.string().min(1).describe("Why you take this action. Cite events as [event 007].");

const TOOLS: Record<string, Tool> = {
  send_message: tool({
    description: "Send an email or SMS to the tenant, the landlord or the assigned contractor. The message goes to the outbox.",
    schema: z.object({
      to: z.enum(["tenant", "landlord", "contractor"]),
      channel: z.enum(["email", "sms"]),
      text: z.string().min(1),
      reason,
    }),
    apply: (i) => {
      if (/\[event \d+\]/i.test(i.text)) throw new Refusal("the message text contains an event reference. Event references belong in reason only; rewrite the text without them.");
      return `${i.channel} to ${i.to} queued in the outbox`;
    },
  }),
  request_landlord_approval: tool({
    description: "Ask the landlord to approve work or a cost. Use this before any contractor visit or any spend.",
    schema: z.object({
      scope: z.string().min(1),
      cost: z.string().min(1).describe('The known cost or quote, for example "£165 + VAT", or "unknown".'),
      reason,
    }),
    apply: (i) => `approval request for "${i.scope}" (cost: ${i.cost}) sent to the landlord`,
  }),
  assign_contractor: tool({
    description: "Assign a maintenance provider. Use this only after the landlord approved the work and is not using their own contractor.",
    schema: z.object({ trade: z.string().min(1), notes: z.string(), reason }),
    apply: (i) => `${i.trade} contractor assigned`,
  }),
  add_note: tool({
    description: "Add an internal note to the case, for example an unrelated request or a missing final check.",
    schema: z.object({ text: z.string().min(1), reason }),
    apply: () => "note added",
  }),
  hold: tool({
    description: "End this run. The case waits for the named party.",
    schema: z.object({ waiting_for: z.enum(HOLD_REASONS), reason }),
    end: true,
    apply: (i, s) => {
      s.status = { kind: "hold", reason: i.waiting_for };
      return `case on hold: ${i.waiting_for}`;
    },
  }),
  escalate: tool({
    description: "End this run. A person takes over the case.",
    schema: z.object({
      summary: z.string().min(1).describe("The handover: what you checked, what is missing or in conflict, and what the person must decide."),
      reason,
    }),
    end: true,
    apply: (i, s) => {
      s.status = { kind: "escalated", summary: i.summary };
      return "case escalated to a person";
    },
  }),
  close_case: tool({
    description: "End this run and close the case. Answer every final check.",
    schema: z.object({
      outcome: z.enum(["work_completed", "resolved_without_work", "withdrawn"]),
      work_confirmed_by: z.string().min(1).describe('Who confirmed the result, with the event, for example "tenant [event 007]".'),
      landlord_informed: z.boolean(),
      keys: z.enum(["returned", "not_issued", "outstanding"]),
      invoice: z.enum(["on_file", "not_required", "outstanding"]),
      reason,
    }),
    end: true,
    apply: (i, s) => {
      if (i.keys === "outstanding") throw new Refusal("keys are outstanding. Confirm the key return first, or hold the case.");
      const { reason: _reason, ...checks } = i;
      s.status = { kind: "closed", checks };
      return "case closed";
    },
  }),
};

export function runTool(
  name: string,
  input: unknown,
  state: CaseState,
  adapters?: Record<string, ToolAdapter>
): ToolOutcome {
  const t = TOOLS[name];
  if (!t) return { ok: false, ends: false, result: `unknown tool "${name}"` };
  const parsed = t.schema.safeParse(input);
  if (!parsed.success) return { ok: false, ends: false, result: `invalid input:\n${z.prettifyError(parsed.error)}` };
  const apply = adapters?.[name] ?? t.apply;
  try {
    return { ok: true, ends: t.end, result: apply(parsed.data as Record<string, unknown>, state) };
  } catch (e) {
    if (e instanceof Refusal) return { ok: false, ends: false, result: `refused: ${e.message}` };
    const errorMsg = e instanceof Error ? e.message : String(e);
    return { ok: false, ends: false, result: `failed: ${errorMsg}` };
  }
}

// The API takes the schema body; the "$schema" dialect marker that zod adds is not part of it.
export const TOOL_SPECS: Anthropic.Tool[] = Object.entries(TOOLS).map(([name, t]) => {
  const { $schema: _dialect, ...schema } = z.toJSONSchema(t.schema);
  return { name, description: t.description, input_schema: schema as Anthropic.Tool.InputSchema };
});
