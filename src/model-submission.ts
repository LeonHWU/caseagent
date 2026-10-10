import type Anthropic from "@anthropic-ai/sdk";

// https://platform.claude.com/docs/en/models/sonnet-5-5/migration-guide
// These models reject forced tool choice. Older supported models retain the
// existing submission behavior; every result still receives local validation.
const AUTO_ONLY = new Set(["claude-sonnet-5-5", "claude-opus-5-5", "claude-fable-5-1", "claude-mythos-5-1"]);
export function submissionToolChoice(model: string, name: string): Anthropic.ToolChoice {
  return AUTO_ONLY.has(model) ? { type: "auto" } : { type: "tool", name };
}
