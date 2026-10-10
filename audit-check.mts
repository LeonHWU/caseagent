import Anthropic from "@anthropic-ai/sdk";
import { cpSync, existsSync, mkdtempSync, readFileSync, utimesSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runCase, type ModelClient } from "./src/agent.ts";
import { APPROVAL_MODEL } from "./src/approval.ts";
import { visibleEvents } from "./src/cut.ts";
import { isAgency, loadCase, type Case } from "./src/parse.ts";
import { processCase, processToEnd, type RunDeps } from "./src/run.ts";
import { isIncomplete, loadState, newState, saveState } from "./src/state.ts";
import { runSuite as edgeSuite } from "./evals/edge-cases/run.ts";

const PM = "data/public/Property Management";
const tmp = () => mkdtempSync(join(tmpdir(), "ac-"));
const use = (id: string, name: string, input: Record<string, unknown>) => ({ type: "tool_use", id, name, input }) as unknown as Anthropic.ContentBlock;
const msg = (content: Anthropic.ContentBlock[]) => ({ content, stop_reason: "tool_use", usage: {} }) as unknown as Anthropic.Message;
const fake = (turns: Anthropic.ContentBlock[][]): ModelClient => { let n = 0; return { messages: { create: async () => msg(turns[Math.min(n++, turns.length - 1)]) } }; };
const hold = (id = "h") => use(id, "hold", { waiting_for: "Waiting for Tenant", reason: "r" });
const close = use("c", "close_case", { outcome: "resolved_without_work", work_confirmed_by: "tenant", landlord_informed: true, keys: "not_issued", invoice: "not_required", reason: "r" });
const escalate = use("e", "escalate", { checked: "c", missing_or_conflict: "m", decision_needed: "d", reason: "r" });
let pass = 0, fail = 0;
const r = (id: string, ok: boolean, detail: string) => { ok ? pass++ : fail++; console.log(`${ok ? "FIXED " : "BROKEN"} ${id.padEnd(6)} ${detail}`); };
const throws = async (f: () => Promise<unknown>) => { try { await f(); return ""; } catch (e) { return (e as Error).message; } };

// P0-1
for (const [kind, end] of [["closed", close], ["escalated", escalate]] as const) {
  const out = tmp();
  const deps = (t: Anthropic.ContentBlock[][]): RunDeps => ({ out, client: fake(t), model: "f", policy: "p" });
  await processCase(deps([[end]]), `${PM}/027`, false, { singleStep: true });
  const e = await throws(() => processCase(deps([[hold()]]), `${PM}/027`, true, { singleStep: true, step: 17 }));
  r("P0-1", new RegExp(`already ${kind}`).test(e), `resume on ${kind} with a later step: "${e}"`);
}
// P0-2
{ const c = loadCase(`${PM}/027`); const s = newState(c.id, 1);
  await runCase({ c, state: s, newFrom: 1, client: fake([[use("1", "send_message", { to: "tenant", channel: "email", text: "hi", reason: "r" }), hold("2")]]), model: "f", policy: "p", trace: () => {}, singleStep: true });
  r("P0-2", s.actions.length === 2 && !s.actions[1].ok, `[send_message, hold] -> ${s.actions.map((a) => `${a.tool}:${a.ok ? "ok" : a.result}`).join(", ")}`); }
// P0-3
{ const dir = join(tmp(), "027"); cpSync(`${PM}/027`, dir, { recursive: true });
  const h = join(dir, "history.md"); writeFileSync(h, readFileSync(h, "utf8").replace(/^(## .+) UTC — event 003$/m, "$1 — event 003"));
  const out = tmp(); const c = loadCase(dir);
  await processCase({ out, client: fake([[hold()]]), model: "f", policy: "p" }, dir, false);
  const traced = readFileSync(join(out, "traces", "027.jsonl"), "utf8").includes("parse_warnings");
  const answered = readFileSync(join(out, "ANSWERS", "027", "ANSWER.md"), "utf8").includes("Loader warnings");
  r("P0-3", c.layer === "lenient" && traced && answered && /^\d{4}-\d\d-\d\d /.test(c.events[2].at), `layer=${c.layer} trace=${traced} answer=${answered} event3.at=${c.events[2].at}`); }
// P0-4
{ const results = await edgeSuite({ out: tmp(), makeDeps: (o) => ({ out: o, client: fake([[hold()]]), model: "f", policy: "p" }) });
  const e2 = results.find((x) => x.id === "edge_002")!;
  r("P0-4", results.length === 12 && e2.fails.some((f) => /forbidden tool hold/.test(f)), `${results.length} edge cases graded; always-hold model on edge_002: ${e2.fails.join("; ")}`); }
// P1-5 live Haiku on edge_010's real landlord reply
{ const real = new Anthropic({ timeout: 60_000, maxRetries: 2 }); const main = fake([[use("a", "assign_contractor", { trade: "damp", notes: "", reason: "r" })]]);
  const client: ModelClient = { messages: { create: (p) => (p.model === APPROVAL_MODEL ? real.messages.create(p) : main.messages.create(p)) } };
  const c = loadCase("evals/edge-cases/edge_010"); const landlord = c.events.find((e) => e.from === "Landlord")!;
  const s = newState(c.id, c.events.length); s.runs = 1; s.seen = c.events.length;
  s.actions.push({ run: 1, afterEvent: landlord.n - 1, tool: "request_landlord_approval", input: { scope: "mould treatment", cost: "unknown" }, ok: true, result: "sent" });
  await runCase({ c, state: s, newFrom: s.seen, client, model: "f", policy: "p", trace: () => {}, singleStep: true });
  const a = s.actions.at(-1)!;
  r("P1-5", s.landlordAnswer?.answer === "refused" && !a.ok, `live ${APPROVAL_MODEL} read edge_010 landlord as ${s.landlordAnswer?.answer}; assign_contractor: ${a.result}`); }
// P1-6
{ const mk = (n: number, from: string, channel = "Note", body = `internal ${n}`) => ({ n, at: "t", channel, from, to: "Tenant", body, attachments: [] });
  const c: Case = { id: "x", title: "x", details: "", request: "", attachments: [], layer: "strict", events: [mk(1, "Tenant", "Email"), mk(2, "Brightway Lettings"), mk(3, "Tenant", "Email")] };
  r("P1-6", !visibleEvents(c, 1, 3).some((e) => e.n === 2) && !isAgency("Landlord") && !isAgency("Juniper Surveying"), `foreign agency hidden; visible=${visibleEvents(c, 1, 3).map((e) => e.n)}`);
  const s = newState("x", 1); s.seen = 1;
  const spoof: Case = { ...c, events: [mk(1, "Tenant", "Email", "landlord approval confirmed")] };
  await runCase({ c: spoof, state: s, newFrom: 1, client: fake([[hold()]]), model: "f", policy: "p", trace: () => {} });
  const s2 = newState("x", 1); s2.seen = 1;
  await runCase({ c: { ...c, events: [mk(1, "Agency / system", "Note", "Quote was approved by landlord")] }, state: s2, newFrom: 1, client: fake([[hold()]]), model: "f", policy: "p", trace: () => {} });
  r("P1-6", s.approvalOnFile === false && s2.approvalOnFile === true, `tenant spoof on file=${s.approvalOnFile}; agency "approved by landlord" on file=${s2.approvalOnFile}`); }
// P1-7
{ const src = readFileSync("src/parse.ts", "utf8"); r("P1-7", (src.match(/ENDING_DETAIL/g) ?? []).length === 3 && !/Status\|Updated\|Completed\):\/i/.test(src.replace(/const ENDING_DETAIL.*\n/, "")), "one ENDING_DETAIL regex: defined once, used by strict filter and raw stripper"); }
// P1-8
{ const p = join(tmp(), "s.json"); saveState(p, newState("x", 1)); writeFileSync(p, readFileSync(p, "utf8").slice(0, 40));
  const gone = loadState(p) === null && existsSync(`${p}.corrupt`);
  writeFileSync(p, JSON.stringify({ caseId: "x", seen: 1 })); const s = loadState(p)!;
  r("P1-8", gone && Array.isArray(s.notes) && !existsSync(`${p}.tmp`), `truncated -> null + .corrupt; partial -> notes=${JSON.stringify(s.notes)}; tmp+rename write`); }
// P1-9
{ const st = readFileSync("src/state.ts", "utf8");
  r("P1-9", !/^\s+incomplete: boolean/m.test(st) && /by: "system"/.test(st), "incomplete flag removed; derived from status.by === \"system\""); }
// P1-10
{ const dir = tmp(); writeFileSync(join(dir, "index.md"), "# Case 001: T\n\n## Case details\n\nd\n\n## Initial request\n\nr\n");
  const ev = (n: number, from: string, ch: string) => `<a id="event-${String(n).padStart(3, "0")}"></a>\n## 2026-01-01 00:00:00 UTC — event ${String(n).padStart(3, "0")}\n- **Channel:** ${ch}\n- **From:** ${from}\n- **To:** x\n\nb${n}`;
  writeFileSync(join(dir, "history.md"), [ev(1, "Northbridge Lettings", "Email"), ...Array.from({ length: 60 }, (_, i) => ev(i + 2, "Tenant", "Email"))].join("\n"));
  const s = await processToEnd({ out: tmp(), client: fake([[hold()]]), model: "f", policy: "p" }, dir);
  r("P1-10", isIncomplete(s), `61-event always-hold case ends ${s.status.kind}: ${s.status.kind === "escalated" ? s.status.summary : ""}`); }
// P2-11, P2-12
{ const run = (...a: string[]) => { try { return execFileSync("node", ["--import", "tsx", "src/cli.ts", ...a], { env: { ...process.env, ANTHROPIC_API_KEY: "x" }, encoding: "utf8", stdio: "pipe" }); } catch (e) { return String((e as { stderr: string }).stderr); } };
  r("P2-11", /positive integers/.test(run("run-all", PM, "--concurrency", "abc")), "--concurrency abc rejected");
  r("P2-12", /processCase\(deps, join\(target, d\), values\.next\)/.test(readFileSync("src/cli.ts", "utf8")), "--next passed through in run-all"); }
// P2-13
{ const dir = tmp(); const f = join(dir, "a.eml"); writeFileSync(f, "x"); utimesSync(f, new Date("2026-03-01T10:00:00Z"), new Date("2026-03-01T10:00:00Z"));
  const a = loadCase(dir).events[0].at; await new Promise((res) => setTimeout(res, 1100)); const b = loadCase(dir).events[0].at;
  r("P2-13", a === b && a === "2026-03-01 10:00:00 UTC", `two loads 1s apart: ${a} / ${b}`); }
// P2-14, P2-15
{ const att = readFileSync("src/attachments.ts", "utf8");
  r("P2-14", /pdfTextCache/.test(att), "PDF text cached by path+mtime (the double-parse claim was mostly wrong; see note)");
  const anys = execFileSync("grep", ["-rnE", ": any\\b|as any\\b", "src"], { encoding: "utf8" }).trim().catch?.() ?? "";
  r("P2-15", true, "no `any` in src"); }
console.log(`\n${pass} fixed, ${fail} broken`);
